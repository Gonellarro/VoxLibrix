# Qwen3-TTS con Docker · Guía de uso

## Estructura de carpetas

```
qwen3-tts/
├── Dockerfile
├── docker-compose.yml
├── servidor_tts.py
├── models/          ← se crea automáticamente (modelos descargados)
└── voice/
    └── referencia.wav  ← TU AUDIO DE REFERENCIA (lo pones tú)
```

---

## Paso 1 — Preparar tu audio de referencia

Graba entre **5 y 15 segundos** de tu voz en un lugar silencioso.
- Formato: WAV o MP3
- Llámalo `referencia.wav` y colócalo en la carpeta `voice/`

```bash
mkdir -p voice models
# Copia aquí tu audio:
cp /ruta/a/tu/grabacion.wav voice/referencia.wav
```

---

## Paso 2 — Configurar la transcripción

Abre `docker-compose.yml` y edita la línea `REF_TEXT`:

```yaml
- REF_TEXT=Escribe aquí EXACTAMENTE lo que dices en el audio de referencia
```

Ejemplo real:
```yaml
- REF_TEXT=Hola, me llamo Jordi y estoy grabando esta muestra de voz para el sistema de síntesis.
```

> ⚠️ Cuanto más exacta sea la transcripción, mejor calidad tendrá el clon de voz.

---

## Paso 3 — Arrancar el servicio

```bash
# Primera vez: construye la imagen (tarda ~5 min descargando dependencias)
docker compose up --build

# Siguientes veces: arrancar directamente
docker compose up

# En segundo plano:
docker compose up -d
```

La primera vez que el servidor recibe una petición, **descarga el modelo automáticamente (~1.2 GB)**.
Queda guardado en `./models/` y no se vuelve a descargar.

---

## Paso 4 — Usar la API

**Verificar que está funcionando:**
```bash
curl http://localhost:8000/health
```

**Generar audio (guarda el resultado como audio.wav):**
```bash
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hola, esto es una prueba del sistema.", "language": "Spanish"}' \
  --output audio.wav
```

**Desde Python:**
```python
import requests

respuesta = requests.post(
    "http://localhost:8000/tts",
    json={"text": "Texto a sintetizar con tu voz.", "language": "Spanish"}
)

with open("audio.wav", "wb") as f:
    f.write(respuesta.content)
```

**Interfaz web interactiva (en el navegador):**
```
http://localhost:8000/docs
```

---

## Idiomas soportados

```
Spanish, English, Chinese, Japanese, Korean,
German, French, Russian, Portuguese, Italian
```

---

## Comandos útiles de Docker

```bash
# Ver logs en tiempo real
docker compose logs -f

# Parar el servicio
docker compose down

# Parar y borrar todo (imagen, contenedor) — los modelos en ./models/ se conservan
docker compose down --rmi all

# Borrar también los modelos descargados
rm -rf models/
```

---

## Cambiar al modelo 1.7B (más calidad)

En `docker-compose.yml`, cambia:
```yaml
- TTS_MODEL=Qwen/Qwen3-TTS-12Hz-1.7B-Base
```
Y vuelve a arrancar. Se descargará automáticamente (~3.4 GB).
