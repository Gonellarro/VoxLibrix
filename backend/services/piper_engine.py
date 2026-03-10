import os
import subprocess
import asyncio
import httpx

PIPER_MODELS_DIR = os.environ.get("PIPER_MODELS_DIR", "/data/piper_models")
PIPER_BINARY = "piper" # Piper CLI binary

os.makedirs(PIPER_MODELS_DIR, exist_ok=True)

# Voces recomendadas para español (es_ES – verificadas en HuggingFace)
SPANISH_VOICES = {
    "es_ES-sharvard-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx",
    "es_ES-davefx-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx",
    "es_ES-carlfm-x_low": "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx",
    "es_ES-mls_9972-low": "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx",
    "es_ES-mls_10246-low": "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx",
}

async def ensure_voice(voice_id: str):
    """Asegura que el modelo de voz existe localmente."""
    if voice_id not in SPANISH_VOICES:
        return False
    
    onnx_path = os.path.join(PIPER_MODELS_DIR, f"{voice_id}.onnx")
    json_path = f"{onnx_path}.json"
    
    if not os.path.exists(onnx_path):
        url = SPANISH_VOICES[voice_id]
        print(f"📥 Descargando voz Piper: {voice_id}...")
        
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            # Descargar ONNX
            resp = await client.get(url)
            resp.raise_for_status()
            with open(onnx_path, "wb") as f:
                f.write(resp.content)
                
            # Descargar JSON (config)
            resp = await client.get(f"{url}.json")
            resp.raise_for_status()
            with open(json_path, "wb") as f:
                f.write(resp.content)
        
    return True



async def generate(text: str, voice_id: str, output_path: str):
    """Genera audio usando Piper TTS."""
    onnx_path = os.path.join(PIPER_MODELS_DIR, f"{voice_id}.onnx")
    
    if not os.path.exists(onnx_path):
        await ensure_voice(voice_id)
        
    # Piper lee de stdin y suelta el audio por stdout o a un archivo
    process = await asyncio.create_subprocess_exec(
        PIPER_BINARY,
        "-m", onnx_path,
        "-f", output_path,
        "--sentence-silence", "0.5",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    stdout, stderr = await process.communicate(input=text.encode("utf-8"))
    
    if process.returncode != 0:
        raise RuntimeError(f"Piper error: {stderr.decode()}")
    
    return output_path
