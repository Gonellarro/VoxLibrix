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
    scaledown_window=450, # Aumentamos el escalado por lotes
    timeout=600,         # Aumentamos timeout para lotes largos
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

    def _generate_single(self, text, language, local_ref_path, ref_text):
        """Genera un solo fragmento de audio."""
        import soundfile as sf
        import torch
        
        # En modo lote, no vaciamos caché en cada frase para no perder rendimiento
        # solo si la memoria está muy llena lo haríamos.
        
        with torch.inference_mode():
            wavs, sr = self.model.generate_voice_clone(
                text=text,
                language=language,
                ref_audio=local_ref_path,
                ref_text=ref_text,
            )

        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV")
        return buffer.getvalue(), sr

    @modal.fastapi_endpoint(method="POST")
    async def tts(self, req: dict):
        import base64
        import torch
        from fastapi import HTTPException
        from fastapi.responses import JSONResponse, Response

        # Soporte para lote o individual
        texts = req.get("texts") # Lista de frases
        is_batch = texts is not None
        
        if not is_batch:
            texts = [req.get("text")]
            
        ref_text = req.get("ref_text", "")
        voice_id = req.get("voice_id")
        ref_audio_b64 = req.get("ref_audio_b64")
        language = req.get("language", "Spanish")

        if not texts[0] or not voice_id:
            raise HTTPException(status_code=400, detail="Faltan parámetros (texts/text, voice_id)")

        voice_path = f"/voices/{voice_id}.wav"
        local_ref_path = f"/tmp/{voice_id}.wav"

        # 1. ¿Tenemos la voz?
        if not os.path.exists(voice_path):
            if not ref_audio_b64:
                raise HTTPException(status_code=404, detail="voice_not_found")
            with open(voice_path, "wb") as f:
                f.write(base64.b64decode(ref_audio_b64))
        
        # 2. Copia local SIEMPRE (para rapidez)
        if not os.path.exists(local_ref_path):
            shutil.copy2(voice_path, local_ref_path)

        # 3. Generación
        results = []
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            print(f"📦 Lote recibido: {len(texts)} fragmento(s)")
            for idx, t in enumerate(texts):
                if not t.strip(): continue
                print(f"  🎙️ [{idx+1}/{len(texts)}] '{t[:60]}...'")
                audio_bytes, _ = self._generate_single(t, language, local_ref_path, ref_text)
                results.append(base64.b64encode(audio_bytes).decode())
            print(f"✅ Lote completado: {len(results)} audios generados")
            
            if is_batch:
                return JSONResponse(content={"audios": results})
            else:
                # Mantener compatibilidad con el endpoint individual si se prefiere
                return Response(content=base64.b64decode(results[0]), media_type="audio/wav")
                
        except Exception as e:
            error_msg = str(e)
            print(f"🔥 Error en GPU L4 Lote: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Error GPU: {error_msg}")
