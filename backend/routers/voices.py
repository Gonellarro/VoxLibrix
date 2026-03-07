import os
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models, schemas
from database import get_db
from services.generator import backend_to_tts_path

router = APIRouter()
DATA_DIR = os.environ.get("DATA_DIR", "/data")
TTS_URL = os.environ.get("TTS_ENGINE_URL", "http://tts-engine:8000")


@router.get("", response_model=list[schemas.VoiceResponse])
async def list_voices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Voice).order_by(models.Voice.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=schemas.VoiceResponse)
async def create_voice(
    name: str = Form(...),
    description: str = Form(""),
    gender: str = Form(None),
    language: str = Form("Spanish"),
    is_active: bool = Form(True),
    audio_file: UploadFile = File(...),
    text_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    voices_dir = os.path.join(DATA_DIR, "voices")
    os.makedirs(voices_dir, exist_ok=True)

    # Guardar audio
    ext = audio_file.filename.rsplit(".", 1)[-1].lower() if "." in audio_file.filename else "wav"
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(voices_dir, filename)
    with open(path, "wb") as f:
        f.write(await audio_file.read())

    # Leer texto de referencia
    ref_text_content = (await text_file.read()).decode("utf-8")

    voice = models.Voice(
        name=name,
        description=description or None,
        gender=gender,
        language=language,
        sample_path=path,
        model_ref=ref_text_content,
        is_active=is_active,
    )
    db.add(voice)
    await db.commit()
    await db.refresh(voice)
    return voice


@router.get("/{voice_id}", response_model=schemas.VoiceResponse)
async def get_voice(voice_id: int, db: AsyncSession = Depends(get_db)):
    v = await db.get(models.Voice, voice_id)
    if not v:
        raise HTTPException(404, "Voz no encontrada")
    return v


@router.put("/{voice_id}", response_model=schemas.VoiceResponse)
async def update_voice(
    voice_id: int,
    name: str = Form(None),
    description: str = Form(None),
    gender: str = Form(None),
    language: str = Form(None),
    is_active: bool = Form(None),
    audio_file: UploadFile = File(None),
    text_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
):
    v = await db.get(models.Voice, voice_id)
    if not v:
        raise HTTPException(404, "Voz no encontrada")

    if name is not None:
        v.name = name
    if description is not None:
        v.description = description
    if gender is not None:
        v.gender = gender
    if language is not None:
        v.language = language
    if is_active is not None:
        v.is_active = is_active
    
    if text_file:
        v.model_ref = (await text_file.read()).decode("utf-8")

    if audio_file:
        voices_dir = os.path.join(DATA_DIR, "voices")
        ext = audio_file.filename.rsplit(".", 1)[-1].lower() if "." in audio_file.filename else "wav"
        filename = f"{uuid.uuid4()}.{ext}"
        path = os.path.join(voices_dir, filename)
        with open(path, "wb") as f:
            f.write(await audio_file.read())
        # Eliminar sample anterior
        if v.sample_path and os.path.exists(v.sample_path):
            try:
                os.remove(v.sample_path)
            except OSError:
                pass
        v.sample_path = path

    await db.commit()
    await db.refresh(v)
    return v


@router.delete("/{voice_id}")
async def delete_voice(voice_id: int, db: AsyncSession = Depends(get_db)):
    v = await db.get(models.Voice, voice_id)
    if not v:
        raise HTTPException(404, "Voz no encontrada")
    if v.sample_path and os.path.exists(v.sample_path):
        try:
            os.remove(v.sample_path)
        except OSError:
            pass
    await db.delete(v)
    await db.commit()
    return {"ok": True}


@router.get("/{voice_id}/sample")
async def get_sample(voice_id: int, db: AsyncSession = Depends(get_db)):
    v = await db.get(models.Voice, voice_id)
    if not v or not os.path.exists(v.sample_path):
        raise HTTPException(404, "Sample no encontrado")
    return FileResponse(v.sample_path, media_type="audio/wav")


@router.post("/{voice_id}/test")
async def test_voice(voice_id: int, payload: schemas.VoiceTestRequest, db: AsyncSession = Depends(get_db)):
    v = await db.get(models.Voice, voice_id)
    if not v:
        raise HTTPException(404, "Voz no encontrada")
    
    async with httpx.AsyncClient(timeout=600) as client:
        try:
            resp = await client.post(f"{TTS_URL}/tts", json={
                "text": payload.text,
                "language": "Spanish",
                "ref_audio": backend_to_tts_path(v.sample_path),
                "ref_text": v.model_ref or "",
            })
            resp.raise_for_status()
            return Response(content=resp.content, media_type="audio/wav")
        except Exception as e:
            raise HTTPException(500, f"Error en motor TTS: {str(e)}")
