import os
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models, schemas
from database import get_db
from services import piper_engine
from services.generator import backend_to_tts_path

router = APIRouter()
TTS_URL = os.environ.get("TTS_ENGINE_URL", "http://tts-engine:8000")

@router.get("/voices")
async def list_all_voices(db: AsyncSession = Depends(get_db)):
    """
    Lista todas las voces disponibles (Piper + Clonación DB) para uso externo.
    """
    # 1. Obtener voces de Piper
    from services.piper_engine import SPANISH_VOICES
    piper_list = []
    for v_id in SPANISH_VOICES:
        piper_list.append({
            "id": v_id,
            "name": v_id.split("-")[1].replace("_", " ").title(),
            "engine": "piper",
            "language": "Spanish",
            "cloned": False
        })

    # 2. Obtener voces de la Base de Datos (Clonación)
    result = await db.execute(select(models.Voice).where(models.Voice.is_active == True))
    db_voices = result.scalars().all()
    cloned_list = []
    for v in db_voices:
        # Verificar si el archivo de audio físico existe
        broken = not os.path.exists(v.sample_path)
        cloned_list.append({
            "id": v.name, # Para OpenAI usamos el nombre como ID preferente
            "db_id": v.id,
            "name": v.name,
            "engine": "qwen",
            "language": v.language or "Spanish",
            "cloned": True,
            "description": v.description,
            "broken": broken
        })

    return {
        "piper_voices": piper_list,
        "cloned_voices": cloned_list,
        "total": len(piper_list) + len(cloned_list)
    }


@router.post("/audio/speech")
async def openai_speech(payload: schemas.OpenAISpeechRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint compatible con la API de OpenAI TTS.
    Mapea 'model' a piper/qwen y 'voice' a la voz correspondiente.
    """
    # 1. Determinar el motor (Engine)
    # tts-1 -> piper (rápido)
    # tts-1-hd -> qwen (alta calidad/clonación)
    model_lower = payload.model.lower()
    engine = "piper"
    if "hd" in model_lower or "qwen" in model_lower:
        engine = "qwen"
    elif "piper" in model_lower:
        engine = "piper"

    # 2. Preparar rutas temporales
    temp_id = uuid.uuid4().hex
    temp_wav = f"/tmp/openai_{temp_id}.wav"
    voice_name = payload.voice
    
    try:
        if engine == "piper":
            # Voces built-in de Piper
            from services.piper_engine import SPANISH_VOICES
            if voice_name not in SPANISH_VOICES:
                # Si no encuentra la voz exacta, intentamos buscar una que contenga el nombre 
                # o devolvemos la primera disponible para no romper la compatibilidad
                match = next((v for v in SPANISH_VOICES if voice_name.lower() in v.lower()), None)
                if match:
                    voice_name = match
                else:
                    voice_name = list(SPANISH_VOICES.keys())[0]
            
            await piper_engine.generate(payload.input, voice_name, temp_wav, speed=payload.speed)
            
        else:
            # Motor QWEN (clonación basada en Base de Datos)
            # Buscamos por nombre (insensible a mayúsculas)
            result = await db.execute(select(models.Voice).where(models.Voice.name.ilike(voice_name)))
            voice = result.scalars().first()
            
            if not voice:
                # Fallback: intentar buscar por ID si el nombre es un número
                try:
                    v_id = int(voice_name)
                    voice = await db.get(models.Voice, v_id)
                except: pass
            
            if not voice:
                raise HTTPException(404, f"Voz de clonación '{voice_name}' no encontrada en la base de datos.")
            
            async with httpx.AsyncClient(timeout=600) as client:
                resp = await client.post(f"{TTS_URL}/tts", json={
                    "text": payload.input,
                    "language": "Spanish",
                    "ref_audio": backend_to_tts_path(voice.sample_path),
                    "ref_text": voice.model_ref or "",
                })
                resp.raise_for_status()
                with open(temp_wav, "wb") as f:
                    f.write(resp.content)
            
            # Soporte de velocidad para Qwen mediante ffmpeg
            if payload.speed != 1.0:
                speed_wav = f"/tmp/openai_{temp_id}_speed.wav"
                # ffmpeg atempo filter (0.5 to 2.0)
                # Si es muy extremo, habría que encadenar filtros, pero 0.5-2.0 suele bastar
                s = max(0.5, min(2.0, payload.speed))
                os.system(f'ffmpeg -y -i "{temp_wav}" -filter:a "atempo={s}" "{speed_wav}"')
                if os.path.exists(speed_wav):
                    os.rename(speed_wav, temp_wav)

        # 3. Conversión de formato
        fmt = payload.response_format.lower()
        if fmt not in ["mp3", "opus", "aac", "flac", "wav"]:
            fmt = "mp3" # Default OpenAI
            
        if fmt == "wav":
            return FileResponse(temp_wav, media_type="audio/wav")
        
        final_file = f"/tmp/openai_{temp_id}.{fmt}"
        # Conversión silenciosa con ffmpeg
        os.system(f'ffmpeg -y -i "{temp_wav}" -acodec {"libmp3lame" if fmt=="mp3" else "copy"} "{final_file}" > /dev/null 2>&1')
        
        # Limpiar el temporal original
        if os.path.exists(temp_wav): 
            os.remove(temp_wav)
            
        media_types = {
            "mp3": "audio/mpeg",
            "opus": "audio/opus",
            "aac": "audio/aac",
            "flac": "audio/flac"
        }
        return FileResponse(final_file, media_type=media_types.get(fmt, "audio/mpeg"))

    except Exception as e:
        if os.path.exists(temp_wav): os.remove(temp_wav)
        print(f"🔥 Error OpenAI Speech: {e}")
        raise HTTPException(500, str(e))
