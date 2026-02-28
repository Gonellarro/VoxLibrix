import io
import os
import torch
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from qwen_tts import Qwen3TTSModel

app = FastAPI(
    title="Qwen3-TTS API",
    description="Síntesis de voz con clonación · Modelo Qwen3-TTS 0.6B",
    version="1.0"
)

# --- Configuración desde variables de entorno ---
MODEL_PATH = os.environ.get("TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")
REF_AUDIO  = os.environ.get("REF_AUDIO",  "/voice/referencia.wav")
REF_TEXT   = os.environ.get("REF_TEXT",   "")

print(f"Cargando modelo: {MODEL_PATH}")
print(f"Audio de referencia: {REF_AUDIO}")

model = Qwen3TTSModel.from_pretrained(
    MODEL_PATH,
    device_map="cpu",
    dtype=torch.float32,         # float32 para CPU
    attn_implementation="eager", # sin flash_attention (solo NVIDIA)
)

print("Modelo listo ✓")

# --- Esquema de la petición ---
class TTSRequest(BaseModel):
    text: str
    language: str = "Spanish"
    ref_audio: str = None  # Opcional: ruta al audio de referencia
    ref_text: str = None   # Opcional: transcripción exacta

# --- Endpoints ---
@app.post(
    "/tts",
    summary="Sintetiza voz clonada a partir de texto",
    response_description="Archivo WAV con el audio generado"
)
async def synthesize(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")

    # Prioridad: petición > variable de entorno
    current_ref_audio = req.ref_audio or REF_AUDIO
    current_ref_text = req.ref_text or REF_TEXT

    if not os.path.exists(current_ref_audio):
        raise HTTPException(
            status_code=500,
            detail=f"Audio de referencia no encontrado en {current_ref_audio}. "
                   "Asegúrate de colocar tu archivo en la carpeta ./voice/"
        )

    if not current_ref_text:
        raise HTTPException(
            status_code=500,
            detail="No se ha proporcionado texto de referencia (REF_TEXT está vacío)."
        )

    try:
        wavs, sr = model.generate_voice_clone(
            text=req.text,
            language=req.language,
            ref_audio=current_ref_audio,
            ref_text=current_ref_text,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    buffer = io.BytesIO()
    sf.write(buffer, wavs[0], sr, format="WAV")
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=audio.wav"}
    )


@app.get("/health", summary="Estado del servicio")
async def health():
    return {
        "status": "ok",
        "model": MODEL_PATH,
        "ref_audio": REF_AUDIO,
        "ref_audio_exists": os.path.exists(REF_AUDIO),
        "ref_text_configured": bool(REF_TEXT),
    }


@app.get("/", summary="Bienvenida")
async def root():
    return {
        "servicio": "Qwen3-TTS API",
        "docs": "http://localhost:8000/docs",
        "uso": "POST /tts con body: {\"text\": \"Tu texto aquí\", \"language\": \"Spanish\"}"
    }
