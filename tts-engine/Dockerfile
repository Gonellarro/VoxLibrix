FROM python:3.12-slim

# Evitar prompts interactivos durante la instalación
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Instalar dependencias de sistema mínimas para audio
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar PyTorch CPU primero (más pesado, así Docker lo cachea en capas)
RUN pip install --no-cache-dir \
    torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Instalar el resto de dependencias
RUN pip install --no-cache-dir \
    qwen-tts \
    soundfile \
    fastapi \
    uvicorn[standard] \
    python-multipart

# Copiar el servidor
COPY servidor_tts.py .

# El modelo se descarga en /models (montado como volumen)
ENV HF_HOME=/models

EXPOSE 8000

CMD ["uvicorn", "servidor_tts:app", "--host", "0.0.0.0", "--port", "8000"]
