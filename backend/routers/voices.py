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
CLOUD_TTS_URL = os.environ.get("CLOUD_TTS_URL")


@router.get("/piper")
async def list_piper_voices():
    """Devuelve las voces Piper disponibles (built-in) con estado de descarga."""
    from services.piper_engine import SPANISH_VOICES, PIPER_MODELS_DIR
    voices = []
    for voice_id in SPANISH_VOICES:
        parts = voice_id.split("-")
        lang = parts[0]
        name = parts[1] if len(parts) > 1 else voice_id
        quality = parts[2] if len(parts) > 2 else "medium"
        onnx_path = os.path.join(PIPER_MODELS_DIR, f"{voice_id}.onnx")
        voices.append({
            "id": voice_id,
            "name": name.replace("_", " ").title(),
            "quality": quality,
            "language": lang,
            "downloaded": os.path.exists(onnx_path),
        })
    return voices


@router.post("/piper/{voice_id}/download")
async def download_piper_voice(voice_id: str):
    """Descarga un modelo de voz Piper."""
    from services.piper_engine import SPANISH_VOICES, ensure_voice
    if voice_id not in SPANISH_VOICES:
        raise HTTPException(404, "Voz Piper no encontrada")
    try:
        await ensure_voice(voice_id)
        return {"ok": True, "message": f"Voz {voice_id} descargada correctamente"}
    except Exception as e:
        raise HTTPException(500, f"Error descargando voz: {str(e)}")


@router.post("/piper/{voice_id}/test")
async def test_piper_voice(voice_id: str, payload: schemas.VoiceTestRequest):
    """Genera una muestra de audio con una voz Piper."""
    from services.piper_engine import SPANISH_VOICES, PIPER_MODELS_DIR, generate
    if voice_id not in SPANISH_VOICES:
        raise HTTPException(404, "Voz Piper no encontrada")
    onnx_path = os.path.join(PIPER_MODELS_DIR, f"{voice_id}.onnx")
    if not os.path.exists(onnx_path):
        raise HTTPException(400, "La voz no está descargada todavía")
    
    import uuid
    output_path = f"/tmp/piper_test_{uuid.uuid4().hex}.wav"
    try:
        await generate(payload.text, voice_id, output_path, speed=1.0)
        return FileResponse(output_path, media_type="audio/wav", filename=f"test_{voice_id}.wav")
    except Exception as e:
        raise HTTPException(500, f"Error generando audio: {str(e)}")


@router.get("", response_model=list[schemas.VoiceResponse])
async def list_voices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Voice).order_by(models.Voice.created_at.desc()))
    voices = result.scalars().all()
    # Usamos un flag temporal que Pydantic recogerá al serializar
    for v in voices:
        object.__setattr__(v, "broken", not os.path.exists(v.sample_path) if v.sample_path else True)
    return voices


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
    object.__setattr__(v, "broken", not os.path.exists(v.sample_path) if v.sample_path else True)
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
    try:
        await db.delete(v)
        await db.commit()
        return {"ok": True}
    except Exception as e:
        await db.rollback()
        # Suele ser una IntegrityError porque la voz se usa en un Audiobook o Mapping
        print(f"🔥 Error al borrar voz {voice_id}: {str(e)}")
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar esta voz porque está siendo usada por audiolibros existentes. Borra primero los audiolibros asociados."
        )


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
    
    # Leer el audio de referencia y convertirlo a base64
    import base64
    if not v.sample_path or not os.path.exists(v.sample_path):
        raise HTTPException(400, "La voz no tiene audio de referencia")
    
    try:
        with open(v.sample_path, "rb") as f:
            ref_audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        raise HTTPException(500, f"Error leyendo audio de referencia: {str(e)}")
    
    async with httpx.AsyncClient(timeout=600) as client:
        try:
            resp = await client.post(f"{TTS_URL}/v1/audio/voice-clone", json={
                "input": payload.text,
                "ref_audio": ref_audio_b64,
                "ref_text": v.model_ref or "",
                "response_format": "wav",
            })
            resp.raise_for_status()
            return Response(content=resp.content, media_type="audio/wav")
        except Exception as e:
            error_msg = str(e)
            print(f"🔥 Error en test_voice: {error_msg}")
            raise HTTPException(500, f"Error en motor TTS: {error_msg}")
