import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import models, schemas
from database import get_db
from services import generator

router = APIRouter()


from sqlalchemy.orm import selectinload


@router.get("", response_model=list[schemas.AudiobookResponse])
async def list_audiobooks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Audiobook)
        .options(
            selectinload(models.Audiobook.book).selectinload(models.Book.author),
            selectinload(models.Audiobook.narrator_voice)
        )
        .order_by(models.Audiobook.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=schemas.AudiobookResponse)
async def create_audiobook(payload: schemas.AudiobookCreate, db: AsyncSession = Depends(get_db)):
    book = await db.get(models.Book, payload.book_id)
    if not book:
        raise HTTPException(404, "Libro no encontrado")
    narrator = await db.get(models.Voice, payload.narrator_voice_id)
    if not narrator:
        raise HTTPException(404, "Voz narradora no encontrada")

    ab = models.Audiobook(
        book_id=payload.book_id,
        narrator_voice_id=payload.narrator_voice_id,
        engine=payload.engine,
        engine_voice_id=payload.engine_voice_id,
        output_format=payload.output_format,
        status="pending",
        total_words=book.word_count or 0,
        start_char=payload.start_char,
        end_char=payload.end_char
    )
    db.add(ab)
    await db.commit()

    # Guardar mapeos de voces para multi_voice
    if payload.voice_mappings:
        for vm in payload.voice_mappings:
            mapping = models.AudiobookVoiceMapping(
                audiobook_id=ab.id,
                tag_name=vm.tag_name,
                voice_id=vm.voice_id,
            )
            db.add(mapping)
        await db.commit()

    # Recargar con relaciones para el response
    result = await db.execute(
        select(models.Audiobook)
        .options(
            selectinload(models.Audiobook.book).selectinload(models.Book.author),
            selectinload(models.Audiobook.narrator_voice)
        )
        .where(models.Audiobook.id == ab.id)
    )
    return result.scalar_one()


@router.get("/{ab_id}", response_model=schemas.AudiobookResponse)
async def get_audiobook(ab_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Audiobook)
        .options(
            selectinload(models.Audiobook.book).selectinload(models.Book.author),
            selectinload(models.Audiobook.narrator_voice)
        )
        .where(models.Audiobook.id == ab_id)
    )
    ab = result.scalar_one_or_none()
    if not ab:
        raise HTTPException(404, "Audiolibro no encontrado")
    return ab


@router.patch("/{ab_id}", response_model=schemas.AudiobookResponse)
async def update_audiobook(ab_id: int, payload: schemas.AudiobookUpdate, db: AsyncSession = Depends(get_db)):
    ab = await db.get(models.Audiobook, ab_id)
    if not ab:
        raise HTTPException(404, "Audiolibro no encontrado")
    
    is_only_position = all(getattr(payload, k) is None for k in payload.model_fields_set if k != 'last_position')

    if not is_only_position and (ab.status == "processing" or generator.is_running(ab_id)):
        raise HTTPException(400, "No se puede editar la configuración mientras se está procesando")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ab, field, value)
    
    # Recalcular palabras si cambia el rango
    if payload.start_char is not None or payload.end_char is not None:
        # Aquí simplificamos, el front enviará los offsets. 
        # Podríamos re-contar palabras si ab.book.txt_path existe
        pass

    await db.commit()
    
    # Recargar relaciones
    result = await db.execute(
        select(models.Audiobook)
        .options(
            selectinload(models.Audiobook.book).selectinload(models.Book.author),
            selectinload(models.Audiobook.narrator_voice)
        )
        .where(models.Audiobook.id == ab_id)
    )
    return result.scalar_one()


@router.get("/{ab_id}/mappings", response_model=list[schemas.VoiceMappingResponse])
async def get_mappings(ab_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.AudiobookVoiceMapping).where(models.AudiobookVoiceMapping.audiobook_id == ab_id)
    )
    return result.scalars().all()


@router.post("/{ab_id}/start")
async def start_generation(
    ab_id: int, 
    use_cloud: bool = False,
    engine: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    ab = await db.get(models.Audiobook, ab_id)
    if not ab:
        raise HTTPException(404, "Audiolibro no encontrado")
    
    # Si se especifica motor por parámetro, priorizarlo
    if engine:
        ab.engine = engine
    elif use_cloud:
        ab.engine = "cloud"
        
    if ab.status == "done":
        raise HTTPException(400, "El audiolibro ya está generado")
    if generator.is_running(ab_id):
        raise HTTPException(400, "La generación ya está en curso")
    
    # Marcamos el inicio de la generación para las métricas
    from datetime import datetime
    ab.started_at = datetime.utcnow()
    ab.status = "processing"
    await db.commit()
    
    await generator.start(ab_id, use_cloud=use_cloud)
    return {"ok": True, "status": "processing"}


@router.post("/{ab_id}/pause")
async def pause_generation(ab_id: int, db: AsyncSession = Depends(get_db)):
    ab = await db.get(models.Audiobook, ab_id)
    if not ab:
        raise HTTPException(404, "Audiolibro no encontrado")
    await generator.pause(ab_id)
    return {"ok": True, "status": "pausing"}


@router.get("/{ab_id}/progress")
async def get_progress(ab_id: int, db: AsyncSession = Depends(get_db)):
    ab = await db.get(models.Audiobook, ab_id)
    if not ab:
        raise HTTPException(404, "Audiolibro no encontrado")
    pct = 0
    if ab.total_chunks > 0:
        pct = round(ab.completed_chunks / ab.total_chunks * 100, 1)
    return {
        "status": ab.status,
        "total_chunks": ab.total_chunks,
        "completed_chunks": ab.completed_chunks,
        "percent": pct,
        "is_running": generator.is_running(ab_id),
        "error_message": ab.error_message,
    }


@router.get("/{ab_id}/download")
async def download_audiobook(ab_id: int, db: AsyncSession = Depends(get_db)):
    ab = await db.get(models.Audiobook, ab_id)
    if not ab or ab.status != "done":
        raise HTTPException(404, "Audio no disponible")
    if not ab.final_audio_path or not os.path.exists(ab.final_audio_path):
        raise HTTPException(404, "Archivo de audio no encontrado en disco")
    return FileResponse(
        ab.final_audio_path,
        media_type="audio/mpeg" if ab.output_format == "mp3" else "audio/wav",
        filename=f"audiobook_{ab_id}.{ab.output_format}",
    )


@router.delete("/{ab_id}")
async def delete_audiobook(ab_id: int, db: AsyncSession = Depends(get_db)):
    ab = await db.get(models.Audiobook, ab_id)
    if not ab:
        raise HTTPException(404, "Audiolibro no encontrado")
    if generator.is_running(ab_id):
        await generator.pause(ab_id)
    if ab.final_audio_path and os.path.exists(ab.final_audio_path):
        try:
            os.remove(ab.final_audio_path)
        except OSError:
            pass
    await db.delete(ab)
    await db.commit()
    return {"ok": True}
