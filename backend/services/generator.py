import os
import re
import asyncio
import httpx
import soundfile as sf
import numpy as np
from datetime import datetime
from sqlalchemy import select, update, delete

import models
from database import AsyncSessionLocal

TTS_URL = os.environ.get("TTS_ENGINE_URL", "http://tts-engine:8000")
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


def parse_chunks(text: str, book_type: str) -> list[dict]:
    """Divide el texto en fragmentos con su tag."""
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
                # Vuelca el buffer anterior como frases
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
        # Vuelca el último buffer
        if buffer:
            for s in re.split(r'(?<=[.!?…])\s+', " ".join(buffer)):
                if s.strip():
                    chunks.append({"seq": seq, "tag": current_tag, "text": s.strip()})
                    seq += 1

    return chunks


async def start(audiobook_id: int):
    """Inicia o reanuda la generación de un audiolibro."""
    if is_running(audiobook_id):
        return
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


async def _generate(audiobook_id: int):
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
                for ch in parsed:
                    tag = ch["tag"]
                    voice = tag_map.get(tag.upper(), narrator) if tag else narrator
                    db.add(models.AudioChunk(
                        audiobook_id=audiobook_id,
                        voice_id=voice.id,
                        sequence_order=ch["seq"],
                        tag_name=tag,
                        source_text=ch["text"],
                        status="pending",
                    ))
                await db.execute(
                    update(models.Audiobook).where(models.Audiobook.id == audiobook_id)
                    .values(total_chunks=len(parsed), completed_chunks=0)
                )
                await db.commit()

        # Directorio de salida
        out_dir = os.path.join(DATA_DIR, "output", str(audiobook_id))
        os.makedirs(out_dir, exist_ok=True)

        async with httpx.AsyncClient(timeout=600) as client:
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
    for ch in chunks:
        if ch.audio_path and os.path.exists(ch.audio_path):
            data, sample_rate = sf.read(ch.audio_path)
            if sr is None:
                sr = sample_rate
            if data.ndim > 1:
                data = data[:, 0]
            segments.append(data)

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
