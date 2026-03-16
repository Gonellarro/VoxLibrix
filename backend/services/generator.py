import os
import re
import asyncio
import httpx
import base64
import soundfile as sf
import numpy as np
from datetime import datetime
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

import models
from database import AsyncSessionLocal
from . import piper_engine

TTS_URL = os.environ.get("TTS_ENGINE_URL", "http://tts-engine:8000")
CLOUD_TTS_URL = os.environ.get("CLOUD_TTS_URL")
DATA_DIR = os.environ.get("DATA_DIR", "/data")

# Estado global de generaciones en curso
_tasks: dict[int, asyncio.Task] = {}
_cancel_set: set[int] = set()


def is_running(audiobook_id: int) -> bool:
    task = _tasks.get(audiobook_id)
    return task is not None and not task.done()


def backend_to_tts_path(path: str) -> str:
    """Convierte ruta del backend (/data/voices/...) a ruta del motor TTS (/voice/...)."""
    return path.replace(os.path.join(DATA_DIR, "voices"), "/voice")




def preprocess_text(text: str) -> str:
    """Expande números a palabras en español y limpia el texto para la TTS."""
    from num2words import num2words

    # Sustituimos todos los números (enteros y decimales) por sus palabras
    def replace_number(match):
        raw = match.group(0).replace(".", "").replace(",", ".")
        try:
            n = float(raw) if "." in raw else int(raw)
            return num2words(n, lang="es")
        except Exception:
            return match.group(0)

    return re.sub(r'\b\d+([.,]\d+)?\b', replace_number, text)


def is_trivial(text: str) -> bool:
    """Devuelve True si el texto no tiene contenido fonético real (solo puntuación, espacios...)."""
    return len(re.sub(r'[^\w]', '', text, flags=re.UNICODE)) < 3

TARGET_CHUNK_WORDS = 60  # Intentamos llegar a este número de palabras
MAX_CHUNK_WORDS = 75     # Límite estricto para evitar alucinaciones de la IA

# ── TIEMPOS DE PAUSA (en segundos) ──
PAUSE_VOICE_CHANGE = 1.0  # Pausa al cambiar de personaje o al narrador
PAUSE_PARAGRAPH = 1.0     # Pausa en punto y aparte
PAUSE_SENTENCE = 0.5      # Pausa estándar entre frases
PAUSE_TITLE = 1.0         # Pausa tras el título del libro


def merge_short_chunks(chunks: list[dict]) -> list[dict]:
    """Fusiona fragmentos de forma agresiva hasta alcanzar TARGET_CHUNK_WORDS.
    No supera MAX_CHUNK_WORDS para mantener la estabilidad del modelo.
    El primer fragmento (título) siempre se mantiene aislado.
    """
    if not chunks:
        return []

    merged = [chunks[0]]  # El primer chunk (título) se queda tal cual
    i = 1

    while i < len(chunks):
        current = chunks[i]
        current_text = current["text"]
        current_words = len(current_text.split())
        current_tag = current["tag"]

        # Intentamos absorber fragmentos siguientes del mismo personaje
        j = i + 1
        while j < len(chunks) and chunks[j]["tag"] == current_tag and current_words < TARGET_CHUNK_WORDS:
            next_text = chunks[j]["text"]
            next_words = len(next_text.split())

            # Solo fusionamos si no nos pasamos del límite de seguridad
            if current_words + next_words <= MAX_CHUNK_WORDS:
                current_text = current_text.rstrip() + " " + next_text.lstrip()
                current_words += next_words
                j += 1
            else:
                break

        merged.append({
            "seq": len(merged),
            "tag": current_tag,
            "text": current_text
        })
        i = j

    return merged


def parse_chunks(text: str, book_type: str) -> list[dict]:
    """Divide el texto en fragmentos con su tag, preprocesados y fusionados.
    Soporta formato <Tag>Contenido</Tag> para multi_voice.
    """
    chunks = []
    seq = 0

    if book_type == "single_voice":
        # Separación por frases normal
        sentences = [s.strip() for s in re.split(r'(?<=[.!?…])\s+', text) if s.strip()]
        for s in sentences:
            chunks.append({"seq": seq, "tag": None, "text": s})
            seq += 1
    else:
        # MODO XML: <Personaje>Texto</Personaje>
        # Buscamos bloques con etiquetas y lo que hay entre ellos
        # El patrón busca <TAG>...</TAG> capturando el tag y el contenido
        parts = re.split(r'(<([^>]+)>.*?</\2>)', text, flags=re.DOTALL)
        
        # re.split con grupos de captura devuelve: [fuera, completo, tag, fuera, ...]
        # Pero queremos algo más limpio:
        raw_parts = []
        last_pos = 0
        for m in re.finditer(r'<([^>]+)>(.*?)</\1>', text, flags=re.DOTALL):
            # Texto antes del tag (Narrador)
            before = text[last_pos:m.start()].strip()
            if before:
                raw_parts.append((None, before))
            
            # Contenido del tag
            tag_name = m.group(1).strip()
            content = m.group(2).strip()
            if content:
                raw_parts.append((tag_name, content))
            
            last_pos = m.end()
        
        # Texto final (Narrador)
        after = text[last_pos:].strip()
        if after:
            raw_parts.append((None, after))

        # Ahora dividimos cada parte en frases para no tener chunks gigantes
        for tag, content in raw_parts:
            # Dividir por frases pero detectar cuál es la última del bloque (párrafo)
            sentences = [s.strip() for s in re.split(r'(?<=[.!?…])\s+', content) if s.strip()]
            for i, s in enumerate(sentences):
                is_para_end = (i == len(sentences) - 1) # Es el final del bloque de texto
                chunks.append({"seq": seq, "tag": tag, "text": s, "is_para_end": is_para_end})
                seq += 1

    # 1. Fusionar chunks cortos con el siguiente del mismo tag
    chunks = merge_short_chunks(chunks)

    # 2. Expandir números a palabras y limpiar cada fragmento
    for ch in chunks:
        # Limpiar puntuación residual que pueda haber quedado pegada por el formato XML
        # ej: ", </Tag>" -> "," (esto evita pausas dobles)
        ch["text"] = re.sub(r'^\s*[,.;:!?]', '', ch["text"]) # Quitar puntuación al inicio del chunk
        ch["text"] = re.sub(r'[,.;:!?]\s*$', lambda m: m.group(0).strip(), ch["text"]) # Quitar espacios tras puntuación al final
        ch["text"] = preprocess_text(ch["text"])

    return chunks


async def start(audiobook_id: int, use_cloud: bool = False):
    """Inicia o reanuda la generación de un audiolibro."""
    if is_running(audiobook_id):
        return
    
    # Aseguramos que el engine esté bien configurado si se pasó use_cloud
    if use_cloud:
        async with AsyncSessionLocal() as db:
            await db.execute(update(models.Audiobook).where(models.Audiobook.id == audiobook_id).values(engine="cloud"))
            await db.commit()

    task = asyncio.create_task(_generate(audiobook_id))
    _tasks[audiobook_id] = task


async def pause(audiobook_id: int):
    """Señaliza la pausa (el loop lo detectará en el siguiente chunk)."""
    _cancel_set.add(audiobook_id)


async def _set_status(audiobook_id: int, status: str, **kwargs):
    async with AsyncSessionLocal() as db:
        values = {"status": status, **kwargs}
        await db.execute(update(models.Audiobook).where(models.Audiobook.id == audiobook_id).values(**values))
        await db.commit()


async def _generate(audiobook_id: int, use_cloud: bool = False):
    try:
        await _set_status(audiobook_id, "processing")

        async with AsyncSessionLocal() as db:
            ab = await db.get(models.Audiobook, audiobook_id)
            book = await db.get(models.Book, ab.book_id)
            narrator = await db.get(models.Voice, ab.narrator_voice_id)

            # Asegurar que engine_voice_id esté poblado para qwen/cloud si está nulo
            if not ab.engine_voice_id and ab.engine in ["qwen", "cloud"]:
                ab.engine_voice_id = narrator.name
                await db.commit()

            # Mapeo tag → voz (multi_voice)
            tag_map: dict[str, models.Voice] = {}
            if book.type == "multi_voice":
                result = await db.execute(
                    select(models.AudiobookVoiceMapping).where(
                        models.AudiobookVoiceMapping.audiobook_id == audiobook_id
                    )
                )
                for m in result.scalars().all():
                    v = await db.get(models.Voice, m.voice_id)
                    tag_map[m.tag_name.upper()] = v

            # ¿Ya hay chunks? (reanudación)
            existing = await db.execute(
                select(models.AudioChunk).where(models.AudioChunk.audiobook_id == audiobook_id).limit(1)
            )
            has_chunks = existing.scalar_one_or_none() is not None

            if not has_chunks:
                with open(book.txt_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Limpieza de saltos de línea excesivos (Sincronizado con el frontal)
                content = re.sub(r'\n{4,}', '\n\n\n', content)

                # Aplicar recorte de rango si existe
                if ab.start_char is not None or ab.end_char is not None:
                    start = ab.start_char or 0
                    end = ab.end_char or len(content)
                    content = content[start:end]

                parsed = parse_chunks(content, book.type)
                total_w = 0
                for ch in parsed:
                    tag = ch["tag"]
                    voice = tag_map.get(tag.upper(), narrator) if tag else narrator
                    text = ch["text"]
                    total_w += len(text.split())
                    db.add(models.AudioChunk(
                        audiobook_id=audiobook_id,
                        voice_id=voice.id,
                        sequence_order=ch["seq"],
                        tag_name=tag,
                        source_text=text,
                        status="pending",
                        is_para_end=ch.get("is_para_end", False)
                    ))
                await db.execute(
                    update(models.Audiobook).where(models.Audiobook.id == audiobook_id)
                    .values(total_chunks=len(parsed), completed_chunks=0, total_words=total_w)
                )
                await db.commit()

        # Directorio de salida
        out_dir = os.path.join(DATA_DIR, "output", str(audiobook_id))
        os.makedirs(out_dir, exist_ok=True)

        async with httpx.AsyncClient(timeout=600, follow_redirects=True) as client:
            while True:
                # Comprobar cancelación
                if audiobook_id in _cancel_set:
                    _cancel_set.discard(audiobook_id)
                    await _set_status(audiobook_id, "pending")
                    return

                # Obtener siguiente chunk pendiente
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(models.AudioChunk)
                        .where(models.AudioChunk.audiobook_id == audiobook_id)
                        .where(models.AudioChunk.status == "pending")
                        .order_by(models.AudioChunk.sequence_order)
                        .limit(1)
                    )
                    chunk = result.scalar_one_or_none()

                if chunk is None:
                    break  # Todos procesados

                # Marcar como procesando
                async with AsyncSessionLocal() as db:
                    await db.execute(
                        update(models.AudioChunk).where(models.AudioChunk.id == chunk.id)
                        .values(status="processing")
                    )
                    await db.commit()
                    voice = await db.get(models.Voice, chunk.voice_id)

                chunk_path = os.path.join(out_dir, f"chunk_{chunk.sequence_order}.wav")
                try:
                    # Filtro anti-trivial
                    if is_trivial(chunk.source_text):
                        print(f"⏭️ Chunk trivial ignorado: '{chunk.source_text}'")
                        async with AsyncSessionLocal() as db:
                            await db.execute(
                                update(models.AudioChunk).where(models.AudioChunk.id == chunk.id)
                                .values(status="done")
                            )
                            await db.execute(
                                update(models.Audiobook).where(models.Audiobook.id == audiobook_id)
                                .values(completed_chunks=models.Audiobook.completed_chunks + 1)
                            )
                            await db.commit()
                        continue

                    if ab.engine == "piper":
                        # 🎺 MODO PIPER (Local ligero)
                        voice_id = ab.engine_voice_id or "es_ES-sharvard-medium"
                        await piper_engine.generate(chunk.source_text, voice_id, chunk_path)
                        
                    elif ab.engine == "cloud" and CLOUD_TTS_URL:
                        # 🛰️ MODO CLOUD SYNC
                        import hashlib
                        with open(voice.sample_path, "rb") as f:
                            audio_data = f.read()
                            voice_id = hashlib.md5(audio_data).hexdigest()
                        
                        payload = {
                            "text": chunk.source_text,
                            "language": "Spanish",
                            "voice_id": voice_id,
                            "ref_text": voice.model_ref or "",
                        }
                        
                        resp = await client.post(CLOUD_TTS_URL, json=payload)
                        if resp.status_code == 404:
                            detail = ""
                            try: detail = resp.json().get("detail", "")
                            except: detail = resp.text
                            if "voice_not_found" in detail:
                                payload["ref_audio_b64"] = base64.b64encode(audio_data).decode()
                                resp = await client.post(CLOUD_TTS_URL, json=payload)
                        
                        resp.raise_for_status()
                        with open(chunk_path, "wb") as f:
                            f.write(resp.content)
                    else:
                        # 🏠 MODO QWEN (Local pesado / Default)
                        resp = await client.post(f"{TTS_URL}/tts", json={
                            "text": chunk.source_text,
                            "language": "Spanish",
                            "ref_audio": backend_to_tts_path(voice.sample_path),
                            "ref_text": voice.model_ref or "",
                        })
                        resp.raise_for_status()
                        with open(chunk_path, "wb") as f:
                            f.write(resp.content)

                    audio_data_vals, sr = sf.read(chunk_path)
                    duration_ms = int(len(audio_data_vals) / sr * 1000)

                    async with AsyncSessionLocal() as db:
                        await db.execute(
                            update(models.AudioChunk).where(models.AudioChunk.id == chunk.id)
                            .values(status="done", audio_path=chunk_path, duration_ms=duration_ms)
                        )
                        await db.execute(
                            update(models.Audiobook).where(models.Audiobook.id == audiobook_id)
                            .values(completed_chunks=models.Audiobook.completed_chunks + 1)
                        )
                        await db.commit()

                except Exception as e:
                    async with AsyncSessionLocal() as db:
                        await db.execute(
                            update(models.AudioChunk).where(models.AudioChunk.id == chunk.id)
                            .values(status="error", error_message=str(e)[:500])
                        )
                        await db.commit()
                    print(f"🔥 Error en chunk {chunk.sequence_order}: {str(e)[:200]}")

        # ── Mezclar y finalizar ──
        await _merge(audiobook_id, out_dir)

    except Exception as e:
        await _set_status(audiobook_id, "error", error_message=str(e)[:500])
    finally:
        _tasks.pop(audiobook_id, None)


def sanitize_filename(name: str) -> str:
    """Convierte un título en un nombre de archivo seguro."""
    from pathvalidate import sanitize_filename as path_sanitize
    return path_sanitize(name, replacement_text="_").strip("_") or "audiobook"


def write_mp3_metadata(mp3_path: str, book, author_name: str | None, cover_abs_path: str | None):
    """Inyecta metadatos ID3v2.4 en un archivo MP3 ya generado."""
    from mutagen.mp3 import MP3
    from mutagen.id3 import TIT2, TPE1, TALB, TCON, TDRC, TPUB, COMM, WOAR, APIC

    try:
        audio = MP3(mp3_path)
    except Exception as e:
        print(f"⚠️ No se pudieron escribir metadatos: {e}")
        return

    # Crear tags ID3 si no existen
    if audio.tags is None:
        audio.add_tags()

    tags = audio.tags

    # Título
    tags.add(TIT2(encoding=3, text=[book.title]))

    # Artista / Autor
    if author_name:
        tags.add(TPE1(encoding=3, text=[author_name]))

    # Álbum = Título del libro
    tags.add(TALB(encoding=3, text=[book.title]))

    # Género
    tags.add(TCON(encoding=3, text=["Audiobook"]))

    # Año
    year = book.year or datetime.utcnow().year
    tags.add(TDRC(encoding=3, text=[str(year)]))

    # Editorial
    if book.publisher:
        tags.add(TPUB(encoding=3, text=[book.publisher]))

    # Comentario
    tags.add(COMM(encoding=3, lang="spa", desc="",
                  text=["Generado por VoxLibrix"]))

    # Web
    tags.add(WOAR(url="https://voxlibrix.martivich.es"))

    # Portada (APIC)
    if cover_abs_path and os.path.exists(cover_abs_path):
        ext = os.path.splitext(cover_abs_path)[1].lower()
        mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
        with open(cover_abs_path, "rb") as img:
            tags.add(APIC(
                encoding=3,
                mime=mime,
                type=3,  # Cover (front)
                desc="Cover",
                data=img.read(),
            ))

    audio.save()
    print(f"✅ Metadatos ID3 escritos en {mp3_path}")


async def refresh_audiobook_metadata(audiobook_id: int):
    """Actualiza etiquetas ID3 y renombra el archivo MP3 si el título cambió."""
    async with AsyncSessionLocal() as db:
        ab = await db.get(models.Audiobook, audiobook_id)
        if not ab or ab.status != "done" or not ab.final_audio_path:
            return

        result_book = await db.execute(
            select(models.Book)
            .options(selectinload(models.Book.author))
            .where(models.Book.id == ab.book_id)
        )
        book = result_book.scalar_one_or_none()
        if not book:
            return

        old_path = ab.final_audio_path
        if not os.path.exists(old_path):
            return

        # 1. Renombrar si el título cambió
        fmt = ab.output_format or "mp3"
        safe_name = sanitize_filename(book.title)
        out_dir = os.path.dirname(old_path)
        new_path = os.path.join(out_dir, f"{safe_name}.{fmt}")

        if old_path != new_path:
            try:
                os.rename(old_path, new_path)
                ab.final_audio_path = new_path
                await db.commit()
            except Exception as e:
                print(f"⚠️ Error al renombrar mp3: {e}")
                new_path = old_path

        # 2. Re-escribir metadatos
        if fmt == "mp3":
            author_name = book.author.name if book.author else None
            cover_abs = os.path.join(DATA_DIR, book.cover_path.lstrip("/")) if book.cover_path else None
            write_mp3_metadata(new_path, book, author_name, cover_abs)


async def _merge(audiobook_id: int, out_dir: str):
    async with AsyncSessionLocal() as db:
        ab = await db.get(models.Audiobook, audiobook_id)
        # Cargar libro con su autor
        result_book = await db.execute(
            select(models.Book)
            .options(selectinload(models.Book.author))
            .where(models.Book.id == ab.book_id)
        )
        book = result_book.scalar_one_or_none()

        result = await db.execute(
            select(models.AudioChunk)
            .where(models.AudioChunk.audiobook_id == audiobook_id)
            .where(models.AudioChunk.status == "done")
            .order_by(models.AudioChunk.sequence_order)
        )
        chunks = result.scalars().all()

    segments = []
    sr = None
    last_voice_id = None
    for idx, ch in enumerate(chunks):
        if ch.audio_path and os.path.exists(ch.audio_path):
            data, sample_rate = sf.read(ch.audio_path)
            if sr is None:
                sr = sample_rate
            if data.ndim > 1:
                data = data[:, 0]
            
            # ── GESTIÓN DE SILENCIOS ──
            
            # 1. Pausa tras el primer fragmento (Título del libro)
            if idx == 0 and len(chunks) > 1:
                silence = np.zeros(int(sr * PAUSE_TITLE), dtype=data.dtype)
                segments.append(silence)

            # 2. Pausa por CAMBIO DE VOZ (Multi-voz)
            elif last_voice_id is not None and last_voice_id != ch.voice_id:
                silence = np.zeros(int(sr * PAUSE_VOICE_CHANGE), dtype=data.dtype)
                segments.append(silence)
            
            # 3. Pausa por PUNTO Y APARTE / Cambio de párrafo
            elif ch.is_para_end:
                silence_base = np.zeros(int(sr * PAUSE_PARAGRAPH), dtype=data.dtype)
                segments.append(silence_base)
            
            else:
                # Pausa estándar entre frases
                silence_base = np.zeros(int(sr * PAUSE_SENTENCE), dtype=data.dtype)
                segments.append(silence_base)

            segments.append(data)
            last_voice_id = ch.voice_id

    if not segments or sr is None:
        raise RuntimeError("Sin segmentos de audio para mezclar")

    merged = np.concatenate(segments)
    fmt = ab.output_format or "mp3"

    # Nombre del archivo basado en el título del libro
    safe_name = sanitize_filename(book.title) if book else f"audiobook_{audiobook_id}"
    final_path = os.path.join(out_dir, f"{safe_name}.{fmt}")

    if fmt == "wav":
        sf.write(final_path, merged, sr)
    else:
        tmp = os.path.join(out_dir, "_tmp_merge.wav")
        sf.write(tmp, merged, sr)
        os.system(f'ffmpeg -y -i "{tmp}" "{final_path}" 2>/dev/null')
        os.remove(tmp)

        # Inyectar metadatos ID3 en el MP3
        if book:
            author_name = book.author.name if book.author else None
            cover_abs = os.path.join(DATA_DIR, book.cover_path.lstrip("/")) if book.cover_path else None
            write_mp3_metadata(final_path, book, author_name, cover_abs)

    # Limpiar chunks temporales de disco y BBDD
    for ch in chunks:
        if ch.audio_path and os.path.exists(ch.audio_path):
            try:
                os.remove(ch.audio_path)
            except OSError:
                pass

    async with AsyncSessionLocal() as db:
        await db.execute(delete(models.AudioChunk).where(models.AudioChunk.audiobook_id == audiobook_id))
        await db.execute(
            update(models.Audiobook).where(models.Audiobook.id == audiobook_id)
            .values(status="done", final_audio_path=final_path, finished_at=datetime.utcnow())
        )
        await db.commit()
