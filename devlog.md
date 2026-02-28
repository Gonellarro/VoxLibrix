# DevLog - Audiobook AI Generator

## Estado: Versión Inicial Funcional (v1.0.0)
*Fecha: 2026-02-28*

Este proyecto es un generador de audiolibros local que utiliza el modelo **Qwen3-TTS** para clonación de voz y síntesis de audio de alta calidad.

### Hitos Alcanzados

#### 1. Arquitectura Base (Dockerizada)
- **TTS Engine**: Servidor FastAPI que expone el modelo Qwen3-TTS-0.6B.
- **Backend API**: Orquestador en Python que gestiona voces, proyectos y el flujo de generación.
- **Frontend**: Interfaz React moderna (Glassmorphism) para gestión visual.
- **Persistencia**: Base de datos SQLite para metadatos y volúmenes Docker para archivos de audio.

#### 2. Gestión de Voces
- Interfaz para subir muestras de audio (5-15s) y transcripciones.
- Catálogo visual de voces clonadas con capacidad de prueba inmediata.

#### 3. Generación de Audiobooks (Mejoras Recientes)
Hemos implementado un sistema de generación robusto con las siguientes capacidades:
- **Procesamiento Asíncrono**: La generación ocurre en segundo plano mediante `BackgroundTasks`, evitando bloqueos en la interfaz.
- **Barra de Progreso Real**: Cálculo preciso basado en el total de frases del texto.
- **Feedback en Vivo**: Visualización en tiempo real de la frase que se está tratando.
- **Guardado Incremental (Safe-Save)**: 
    - El audio final (`final_audio.wav`) se reconstruye tras cada frase.
    - Si el proceso se detiene, el archivo acumulado siempre es válido y reproducible hasta el punto donde se quedó.
- **Auto-Descarga**: El sistema inicia la descarga del resultado final una vez completado al 100%.

### Estructura de Datos
- `/data/voices/`: Almacena los audios de referencia.
- `/data/output/`: Almacena los segmentos individuales y los archivos finales por proyecto.

### Próximos Pasos (Pendientes)
- Refinar el Look & Feel según preferencias del usuario.
- Soporte para archivos EPUB directamente.
- Gestión de múltiples voces en un mismo libro (asignación por personajes).
