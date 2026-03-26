import os
import io
import torch
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from qwen_tts import Qwen3TTSModel

# --- Configuración básica ---
MODEL_PATH = os.environ.get("TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")
DEVICE     = os.environ.get("DEVICE", "cuda:0")
DTYPE      = os.environ.get("DTYPE", "bfloat16")
REF_AUDIO  = os.environ.get("REF_AUDIO", "/voice/referencia.wav")
REF_TEXT   = os.environ.get("REF_TEXT", "Esta es una voz de prueba.")

print(f"--- Iniciando Motor TTS (ROCm) ---")
print(f"Cargando modelo Base para CLONACIÓN desde {MODEL_PATH}...", flush=True)

# Cargar modelo con precisión segura para CPU
if DTYPE == "float32":
    torch_dtype = torch.float32
elif DTYPE == "bfloat16":
    torch_dtype = torch.bfloat16
else:
    torch_dtype = torch.float16

model = Qwen3TTSModel.from_pretrained(MODEL_PATH, device_map=DEVICE, dtype=torch_dtype)

# Inspección básica por si falla
if not hasattr(model, "generate_voice_clone"):
    print(f"⚠️ El modelo no tiene 'generate_voice_clone'. Métodos: {[m for m in dir(model) if not m.startswith('_')]}")

print(f"✅ Motor Base cargado y listo en {DEVICE}")

app = FastAPI()

class TTSRequest(BaseModel):
    text: str
    language: str = "Spanish"
    ref_audio: str = None
    ref_text: str = None

@app.post("/tts")
async def synthesize(req: TTSRequest):
    print(f"\n>> Petición recibida: {req.text[:30]}...", flush=True)
    try:
        # 1. Resolver audio de referencia
        audio_ref = req.ref_audio or REF_AUDIO
        if not os.path.exists(audio_ref):
            print(f"⚠️ {audio_ref} no existe, buscando fallback en /voice...", flush=True)
            files = [f for f in os.listdir("/voice") if f.endswith((".wav", ".mp3", ".flac"))]
            if files:
                audio_ref = os.path.join("/voice", files[0])
                print(f"✅ Usando: {audio_ref}", flush=True)
            else:
                raise Exception("No hay audios en /voice para clonar")

        text_ref = req.ref_text or REF_TEXT

        # 2. GENERAR (Clonación de voz)
        print(f"Clonando voz con {audio_ref}...", flush=True)
        wavs, sr = model.generate_voice_clone(
            text=req.text,
            language=req.language,
            ref_audio=audio_ref,
            ref_text=text_ref
        )
        print(f"✨ Audio generado", flush=True)

        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV")
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="audio/wav")

    except Exception as e:
        print(f"🔥 ERROR: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
