# Documentación de API - Motores TTS

Esta guía detalla cómo interactuar con los motores de síntesis de voz (Piper y Qwen) desde fuera de la aplicación.

## 1. Motor Piper (Voces Rápidas / Onnx)

El motor Piper está integrado directamente en el contenedor del **Backend**. No requiere servicios adicionales y es muy eficiente.

### Listar Voces Disponibles
```bash
curl -X GET http://localhost:8080/voices/piper
```

### Generar Audio
**Endpoint:** `POST /voices/piper/{voice_id}/test`

**Ejemplo de comando:**
```bash
curl -X POST http://localhost:8080/voices/piper/es_ES-sharvard-medium/test \
     -H "Content-Type: application/json" \
     -d '{
           "text": "Hola, este es un texto generado mediante la API de Piper."
         }' \
     --output audio_piper.wav
```

---

## 2. Motor Qwen (Clonación de Voz Premium)

Qwen funciona como un servicio independiente (`tts-engine`) y permite clonar voces a partir de una muestra de audio.

### A. A través del Wrapper del Backend (Recomendado)
Utiliza las voces que ya tienes guardadas en la base de datos de la aplicación.

**Endpoint:** `POST /voices/{voice_id}/test`

**Ejemplo de comando:**
```bash
# Donde '1' es el ID de una voz existente en tu base de datos
curl -X POST http://localhost:8080/voices/1/test \
     -H "Content-Type: application/json" \
     -d '{
           "text": "Texto para clonar con la voz de la base de datos."
         }' \
     --output audio_clonado.wav
```

### B. Ataque Directo al Motor (Low Level)
Si quieres enviar tú mismo el audio de referencia sin usar la base de datos.
*Nota: Requiere que el puerto 8000 esté expuesto en `docker-compose.yml`.*

**Endpoint:** `POST /tts`

**Payload JSON:**
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `text` | string | El texto a convertir a voz. |
| `language` | string | "Spanish", "English", "Chinese", etc. |
| `ref_audio` | string | Ruta absoluta **dentro del contenedor** al archivo .wav de referencia. |
| `ref_text` | string | El texto que se dice en el `ref_audio` (ayuda a la precisión). |

**Ejemplo de comando:**
```bash
curl -X POST http://localhost:8000/tts \
     -H "Content-Type: application/json" \
     -d '{
           "text": "Prueba de clonación directa.",
           "language": "Spanish",
           "ref_audio": "/voice/referencia.wav",
           "ref_text": "Esta es la voz de referencia."
         }' \
     --output audio_directo.wav
```

---

## 3. Códigos de Voz Estándar (Piper)
Estos son los IDs que puedes usar en la URL de Piper:
- `es_ES-sharvard-medium` (Voz clara, neutra)
- `es_ES-davefx-medium` (Voz masculina más grave)
- `es_ES-carlfm-x_low` (Voz masculina muy rápida/ligera)
- `es_ES-mls_9972-low` (Voz diversa)
- `es_ES-mls_10246-low` (Voz diversa)

---

## 4. API Compatible con OpenAI (Recomendada para aplicaciones externas)

Esta API permite usar el servidor como un reemplazo directo de OpenAI. Muchas herramientas de IA ya soportan este formato.

**Endpoints:**
- `GET /v1/voices`: Lista todas las voces disponibles (Piper y Clonación). Incluye un campo `broken: true` si a la voz clonada le falta su archivo de origen.
- `POST /v1/audio/speech`: Genera audio compatible con OpenAI.

**Parámetros para `POST /v1/audio/speech`:**
- `model`: (`tts-1` para Piper, `tts-1-hd` para Qwen).
- `input`: El texto a sintetizar.
- `voice`: ID de la voz de Piper (ej: `es_ES-sharvard-medium`) o **Nombre** de la voz clonada en tu base de datos.
- `response_format`: `mp3` (default), `wav`, `flac`, `aac`.
- `speed`: De `0.25` a `4.0` (Piper) o `0.5` a `2.0` (Qwen).

**Ejemplo de comando:**
```bash
curl -X POST http://localhost:8080/v1/audio/speech \
     -H "Content-Type: application/json" \
     -d '{
           "model": "tts-1",
           "input": "Este es un mensaje compatible con el estándar de OpenAI.",
           "voice": "es_ES-sharvard-medium",
           "response_format": "mp3",
           "speed": 1.0
         }' \
     --output speech_openai.mp3
```
