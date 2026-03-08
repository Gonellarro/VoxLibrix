import os
import re
import asyncio
import httpx
import base64
import soundfile as sf
import numpy as np
from datetime import datetime
from sqlalchemy import select, update, delete

import models
from database import AsyncSessionLocal

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
    """Divide el texto en fragmentos con su tag, preprocesados y fusionados."""
    chunks = []
    seq = 0

    if book_type == "single_voice":
        sentences = [s.strip() for s in re.split(r'(?<=[.!?…])\s+', text) if s.strip()]
        for s in sentences:
            chunks.append({"seq": seq, "tag": None, "text": s})
            seq += 1
    else:
        current_tag = None
        buffer = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            m = re.match(r'^\[([^\]]+)\](.*)', line)
            if m:
                if buffer:
                    for s in re.split(r'(?<=[.!?…])\s+', " ".join(buffer)):
                        if s.strip():
                            chunks.append({"seq": seq, "tag": current_tag, "text": s.strip()})
                            seq += 1
                current_tag = m.group(1).strip()
                rest = m.group(2).strip()
                buffer = [rest] if rest else []
            else:
                buffer.append(line)
        if buffer:
            for s in re.split(r'(?<=[.!?…])\s+', " ".join(buffer)):
                if s.strip():
                    chunks.append({"seq": seq, "tag": current_tag, "text": s.strip()})
                    seq += 1

    # 1. Fusionar chunks cortos con el siguiente del mismo tag
    chunks = merge_short_chunks(chunks)

    # 2. Expandir números a palabras y limpiar cada fragmento
    for ch in chunks:
        ch["text"] = preprocess_text(ch["text"])

    return chunks


async def start(audiobook_id: int, use_cloud: bool = False):
    """Inicia o reanuda la generación de un audiolibro."""
    if is_running(audiobook_id):
        return
    task = asyncio.create_task(_generate(audiobook_id, use_cloud))
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

                try:
                    # Filtro anti-trivial: si el texto no tiene contenido fonético real, lo saltamos
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

                    if use_cloud and CLOUD_TTS_URL:
                        # 🛰️ MODO CLOUD SYNC: Sincronización inteligente de voces
                        import hashlib
                        with open(voice.sample_path, "rb") as f:
                            audio_data = f.read()
                            # ID único basado en el contenido del audio (si cambia el audio, cambia el ID)
                            voice_id = hashlib.md5(audio_data).hexdigest()
                        
                        payload = {
                            "text": chunk.source_text,
                            "language": "Spanish",
                            "voice_id": voice_id,
                            "ref_text": voice.model_ref or "",
                        }
                        
                        # Intento 1: Sin audio (rápido, si ya está en la nube)
                        resp = await client.post(CLOUD_TTS_URL, json=payload)
                        
                        # Intento 2: Si la nube no la tiene, la mandamos (solo una vez en la vida)
                        if resp.status_code == 404:
                            try:
                                detail = resp.json().get("detail", "")
                            except Exception:
                                detail = resp.text
                            if "voice_not_found" in detail:
                                print(f"🛰️ Sincronizando voz '{voice.name}' con la nube (primera vez)...")
                                payload["ref_audio_b64"] = base64.b64encode(audio_data).decode()
                                resp = await client.post(CLOUD_TTS_URL, json=payload)
                    else:
                        # Local
                        resp = await client.post(f"{TTS_URL}/tts", json={
                            "text": chunk.source_text,
                            "language": "Spanish",
                            "ref_audio": backend_to_tts_path(voice.sample_path),
                            "ref_text": voice.model_ref or "",
                        })
                    resp.raise_for_status()

                    chunk_path = os.path.join(out_dir, f"chunk_{chunk.sequence_order:05d}.wav")
                    with open(chunk_path, "wb") as f:
                        f.write(resp.content)

                    audio_data, sr = sf.read(chunk_path)
                    duration_ms = int(len(audio_data) / sr * 1000)

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

        # ── Mezclar y finalizar ──
        await _merge(audiobook_id, out_dir)

    except Exception as e:
        await _set_status(audiobook_id, "error", error_message=str(e)[:500])
    finally:
        _tasks.pop(audiobook_id, None)


async def _merge(audiobook_id: int, out_dir: str):
    async with AsyncSessionLocal() as db:
        ab = await db.get(models.Audiobook, audiobook_id)
        result = await db.execute(
            select(models.AudioChunk)
            .where(models.AudioChunk.audiobook_id == audiobook_id)
            .where(models.AudioChunk.status == "done")
            .order_by(models.AudioChunk.sequence_order)
        )
        chunks = result.scalars().all()

    segments = []
    sr = None
    for idx, ch in enumerate(chunks):
        if ch.audio_path and os.path.exists(ch.audio_path):
            data, sample_rate = sf.read(ch.audio_path)
            if sr is None:
                sr = sample_rate
            if data.ndim > 1:
                data = data[:, 0]
            segments.append(data)
            # Pausa de 1 segundo tras el primer fragmento (título)
            if idx == 0 and len(chunks) > 1:
                silence = np.zeros(sr, dtype=data.dtype)  # 1s de silencio
                segments.append(silence)

    if not segments or sr is None:
        raise RuntimeError("Sin segmentos de audio para mezclar")

    merged = np.concatenate(segments)
    fmt = ab.output_format or "mp3"
    final_path = os.path.join(out_dir, f"audiobook_{audiobook_id}.{fmt}")

    if fmt == "wav":
        sf.write(final_path, merged, sr)
    else:
        tmp = os.path.join(out_dir, "_tmp_merge.wav")
        sf.write(tmp, merged, sr)
        os.system(f'ffmpeg -y -i "{tmp}" "{final_path}" 2>/dev/null')
        os.remove(tmp)

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
