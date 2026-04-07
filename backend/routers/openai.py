import os
import uuid
import httpx
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
import models
import schemas
from services import piper_engine

router = APIRouter()

# URL del motor TTS (Qwen)
TTS_URL = os.environ.get("TTS_ENGINE_URL", "http://tts-engine:8000")

def backend_to_tts_path(path: str) -> str:
    """Convierte la ruta local del backend a la ruta montada en el tts-engine"""
    if not path: return ""
    return path.replace("/data/voices/", "/voice/")

def _iter_file(path: str):
    """Genera chunks del archivo y lo borra al terminar (streaming real)"""
    try:
        with open(path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk
    finally:
        if os.path.exists(path):
            os.remove(path)

@router.get("/voices")
async def list_voices_openai(db: AsyncSession = Depends(get_db)):
    """Lista las voces compatibles con el formato de OpenAI"""
    from services.piper_engine import SPANISH_VOICES
    piper_list = []
    for vid, name in SPANISH_VOICES.items():
        piper_list.append({
            "id": vid,
            "name": name,
            "engine": "piper",
            "language": "Spanish",
            "cloned": False
        })
    
    result = await db.execute(select(models.Voice).where(models.Voice.is_active == True))
    db_voices = result.scalars().all()
    cloned_list = []
    for v in db_voices:
        broken = not os.path.exists(v.sample_path) if v.sample_path else True
        cloned_list.append({
            "id": v.name,
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
async def speech(payload: schemas.OpenAISpeechRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint compatible con la API de OpenAI TTS.
    """
    # 1. Determinar el motor (Engine)
    model_lower = payload.model.lower()
    engine = "piper"
    if "hd" in model_lower or "qwen" in model_lower:
        engine = "qwen"
    
    # Mapeo de voces estándar de OpenAI a Piper local
    openai_mapping = {
        "alloy": "es_ES-sharvard-medium",
        "echo": "es_ES-davefx-medium",
        "fable": "es_ES-carlfm-x_low",
        "onyx": "es_ES-mls_9972-low",
        "nova": "es_ES-mls_10246-low",
        "shimmer": "es_ES-sharvard-medium"
    }
    
    voice_name = payload.voice
    if voice_name.lower() in openai_mapping:
        voice_name = openai_mapping[voice_name.lower()]
        engine = "piper"

    # 2. Rutas temporales
    temp_id = uuid.uuid4().hex
    temp_wav = f"/tmp/openai_{temp_id}.wav"
    
    try:
        if engine == "piper":
            from services.piper_engine import SPANISH_VOICES
            if voice_name not in SPANISH_VOICES:
                match = next((v for v in SPANISH_VOICES if voice_name.lower() in v.lower()), None)
                voice_name = match if match else "es_ES-sharvard-medium"
            
            await piper_engine.generate(payload.input, voice_name, temp_wav, speed=payload.speed)
            
        else:
            # Motor QWEN
            result = await db.execute(select(models.Voice).where(models.Voice.name.ilike(voice_name)))
            voice = result.scalars().first()
            
            if not voice:
                try:
                    v_id = int(voice_name)
                    voice = await db.get(models.Voice, v_id)
                except: pass
            
            else:
                import base64
                if not voice.sample_path or not os.path.exists(voice.sample_path):
                    await piper_engine.generate(payload.input, "es_ES-sharvard-medium", temp_wav, speed=payload.speed)
                else:
                    async with httpx.AsyncClient(timeout=600) as client:
                        with open(voice.sample_path, "rb") as f:
                            audio_data = f.read()
                            
                        payload_qwen = {
                            "input": payload.input,
                            "ref_audio": base64.b64encode(audio_data).decode("utf-8"),
                            "ref_text": voice.model_ref or "",
                            "response_format": "wav"
                        }
                        
                        resp = await client.post(f"{TTS_URL}/v1/audio/voice-clone", json=payload_qwen)
                        resp.raise_for_status()
                        with open(temp_wav, "wb") as f:
                            f.write(resp.content)
                
                if payload.speed != 1.0:
                    speed_wav = f"/tmp/openai_{temp_id}_speed.wav"
                    s = max(0.5, min(2.0, payload.speed))
                    os.system(f'ffmpeg -y -i "{temp_wav}" -filter:a "atempo={s}" "{speed_wav}" > /dev/null 2>&1')
                    if os.path.exists(speed_wav):
                        os.rename(speed_wav, temp_wav)

        # 3. Verificar que el WAV no esté vacío
        if not os.path.exists(temp_wav) or os.path.getsize(temp_wav) == 0:
            print(f"🔥 OpenAI TTS: WAV vacío o inexistente tras generación", flush=True)
            raise HTTPException(500, "Audio generado vacío")
        
        print(f"📤 WAV generado: {os.path.getsize(temp_wav)} bytes", flush=True)

        # 4. Formato y envío
        fmt = payload.response_format.lower()
        if fmt not in ["mp3", "opus", "aac", "flac", "wav"]:
            fmt = "mp3"
            
        if fmt == "wav":
            file_size = os.path.getsize(temp_wav)
            return StreamingResponse(
                _iter_file(temp_wav),
                media_type="audio/wav",
                headers={"Content-Length": str(file_size)}
            )
        
        final_file = f"/tmp/openai_{temp_id}.{fmt}"
        codec_map = {
            "mp3": "libmp3lame",
            "opus": "libopus",
            "aac": "aac",
            "flac": "flac",
        }
        codec = codec_map.get(fmt, "libmp3lame")
        os.system(f'ffmpeg -y -i "{temp_wav}" -acodec {codec} "{final_file}" > /dev/null 2>&1')
        
        if os.path.exists(temp_wav): os.remove(temp_wav)

        if not os.path.exists(final_file) or os.path.getsize(final_file) == 0:
            print(f"🔥 OpenAI TTS: ffmpeg falló, {final_file} vacío", flush=True)
            raise HTTPException(500, "Conversión de audio falló")
        
        file_size = os.path.getsize(final_file)
        print(f"📤 OpenAI TTS: enviando {fmt.upper()} ({file_size} bytes)", flush=True)

        media_types = {
            "mp3": "audio/mpeg",
            "opus": "audio/opus",
            "aac": "audio/aac",
            "flac": "audio/flac"
        }
        
        # StreamingResponse con chunked transfer (como la API real de OpenAI)
        return StreamingResponse(
            _iter_file(final_file),
            media_type=media_types.get(fmt, "audio/mpeg"),
            headers={"Content-Length": str(file_size)}
        )

    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(temp_wav): os.remove(temp_wav)
        print(f"🔥 Error OpenAI: {e}")
        raise HTTPException(500, str(e))
