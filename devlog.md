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

## Hitos Alcanzados (v1.1.0)
*Fecha: 2026-03-08*

Este proyecto ha evolucionado de un generador local a **VoxLibrix**, una plataforma con visión de SaaS (Software as a Service) orientada a la nube. Hemos sentado las bases para la profesionalización del código y la seguridad de los datos.

### 4. Transición a VoxLibrix & Cloud Ready
- **Rebranding**: Cambio de nombre oficial a **VoxLibrix** y rediseño completo del `README.md` con visión comercial (SaaS) y roadmap público.
- **Arquitectura de Rama Profesional**: Implementación de la rama `feature/cloud-integration` para aislar el desarrollo de infraestructura de nube.
- **Seguridad & Git Ops**: 
    - Reconfiguración profunda de `.gitignore` para blindar datos personales (libros, voces, modelos de IA).
    - Limpieza de histórico para asegurar que ningún archivo privado se suba a repositorios públicos.
    - Sincronización oficial con GitHub bajo la organización `Gonellarro/VoxLibrix`.
- **Análisis de Infraestructura Cloud**: Evaluación técnica de proveedores de GPU para escalado comercial (*Modal.com*, *RunPod*, *Hugging Face Endpoints*).

### 5. Mejoras de UI/UX (Marzo 2026)
- Refinamiento de la interfaz de usuario para dispositivos móviles y escritorio.
- Corrección de superposición de iconos en el editor de audiolibros.
- Mejoras en la legibilidad del historial de proyectos.

---

### Estado de Infraestructura
- **Local**: Docker Compose (CPU y ROCm AMD).
- **Cloud (En desarrollo)**: Planificación de migración a CUDA y persistencia en S3.

### Roadmap Actualizado
- [ ] **Migración a CUDA**: Optimizar contenedores para GPUs NVIDIA en producción.
- [ ] **Sistemas de Pago**: Integración de Stripe para facturación por palabra generada.
- [ ] **Multi-Tenancy**: Gestión de perfiles de usuario y privacidad de archivos.
- [ ] **Almacenamiento Persistente**: Conexión con Buckets de S3 para sustituir volúmenes locales.
- [ ] **Soporte EPUB**: Parser automático de libros electrónicos.
