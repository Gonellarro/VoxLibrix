import modal
import io
import os
import shutil

# 1. Imagen con librerías CUDA 12.1
image = (
    modal.Image.debian_slim()
    .apt_install("libsndfile1", "ffmpeg", "sox", "libsox-fmt-all")
    .pip_install(
        "torch", "torchaudio",
        extra_options="--index-url https://download.pytorch.org/whl/cu121"
    )
    .pip_install(
        "qwen-tts", "soundfile", "fastapi", "python-multipart",
        "accelerate", "transformers", "huggingface_hub"
    )
    .env({"HF_HOME": "/models"})
)

model_volume = modal.Volume.from_name("voxlibrix-models", create_if_missing=True)
# NFS para voces persistentes: se sube una vez, se usa siempre
voices_nfs = modal.NetworkFileSystem.from_name("voxlibrix-voices", create_if_missing=True)

app = modal.App("voxlibrix-tts")

@app.cls(
    image=image,
    gpu="L4",
    volumes={"/models": model_volume},
    network_file_systems={"/voices": voices_nfs},
    scaledown_window=300,
)
class TTS:
    @modal.enter()
    def load_model(self):
        from qwen_tts import Qwen3TTSModel
        import torch
        from huggingface_hub import snapshot_download

        model_path = "/models/qwen3-0.6b"
        if not os.path.exists(os.path.join(model_path, "config.json")):
            print("📦 Descargando modelo al disco persistente...")
            snapshot_download(
                repo_id="Qwen/Qwen3-TTS-12Hz-0.6B-Base",
                local_dir=model_path,
                local_dir_use_symlinks=False
            )

        print("⚡ Cargando Qwen en modo BFLOAT16 (L4 Turbo)...")
        self.model = Qwen3TTSModel.from_pretrained(
            model_path,
            device_map="cuda:0",
            dtype=torch.bfloat16,
        )
        print("✓ Motor VoxLibrix L4 activo")

    def _generate_audio(self, text, language, ref_audio_path, ref_text):
        """Genera audio. Lee la voz desde el disco LOCAL (no NFS) para máxima velocidad."""
        import soundfile as sf
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        # FIX 2: Copiamos la voz al disco LOCAL antes de entregarla a la GPU
        # El NFS es lento y puede no haber completado la escritura.
        local_ref_path = f"/tmp/{os.path.basename(ref_audio_path)}"
        if not os.path.exists(local_ref_path):
            shutil.copy2(ref_audio_path, local_ref_path)

        # FIX 3: Sin try/except inútil. Los errores suben solos al llamador.
        print(f"🎙️ Generando: '{text[:50]}...' con voz {os.path.basename(ref_audio_path)}")
        with torch.inference_mode():
            wavs, sr = self.model.generate_voice_clone(
                text=text,
                language=language,
                ref_audio=local_ref_path,  # Usamos la copia local
                ref_text=ref_text,
            )

        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV")
        return buffer.getvalue()

    @modal.fastapi_endpoint(method="POST")
    async def tts(self, req: dict):
        import base64
        from fastapi import HTTPException
        from fastapi.responses import Response

        text = req.get("text")
        ref_text = req.get("ref_text", "")
        voice_id = req.get("voice_id")
        ref_audio_b64 = req.get("ref_audio_b64")
        language = req.get("language", "Spanish")

        if not text or not voice_id:
            raise HTTPException(status_code=400, detail="Faltan parámetros (text, voice_id)")

        voice_path = f"/voices/{voice_id}.wav"

        # 1. ¿Tenemos la voz en el NFS?
        if not os.path.exists(voice_path):
            if not ref_audio_b64:
                # FIX 4: JSON estandarizado para que el backend lo detecte fiablemente
                print(f"❓ Voz {voice_id} no encontrada. Pidiendo sincronización al backend.")
                raise HTTPException(status_code=404, detail="voice_not_found")

            # Guardamos la voz en el NFS para siempre
            print(f"💾 Sincronizando nueva voz: {voice_id}")
            with open(voice_path, "wb") as f:
                f.write(base64.b64decode(ref_audio_b64))
            print(f"✅ Voz {voice_id} guardada en el NFS.")

        # 2. FIX 1: Generamos con manejo correcto de errores de GPU
        try:
            output = self._generate_audio(text, language, voice_path, ref_text)
            return Response(content=output, media_type="audio/wav")
        except Exception as e:
            # Devolvemos un HTTP 500 legible en lugar de matar el proceso
            error_msg = str(e)
            print(f"🔥 Error en GPU L4: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Error de generación GPU: {error_msg}")
