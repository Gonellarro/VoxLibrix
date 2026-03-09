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

## v0.2.0 - VoxLibrix Cloud Turbo & Sync
*Fecha: 2026-03-08*

Hemos alcanzado la madurez en la infraestructura de nube, logrando un sistema significativamente más rápido y eficiente en costes mediante el despliegue en Modal.com con GPUs Nvidia L4.

### 6. Despliegue en Modal & Optimización Turbo
- **Motor Cloud Directo**: Creación de `cloud_tts.py` para despliegue instantáneo de Qwen3-TTS en GPUs Nvidia L4 (acceso vía FastAPI remoto).
- **Sincronización Inteligente de Voces**: 
    - Implementación de `voxlibrix-voices` (NetworkFileSystem).
    - Las voces se suben una sola vez; el sistema usa huellas MD5 para reutilizar voces ya existentes en la nube, eliminando el 90% del tráfico de internet.
- **Súper-Agregador de Chunks**: 
    - Fusión inteligente de frases hasta un límite seguro (Target: 60, Max: 75 palabras).
    - Esto reduce drásticamente el número de llamadas a la API y el coste operativo por libro.
- **Telemetría de Rendimiento**:
    - Cronómetro en tiempo real y métricas de palabras por segundo (pal/s).
    - Comparativa directa entre generación Local vs Nube.
- **Normalización Lingüística**:
    - Expansión automática de números a palabras en español (`num2words`).
    - Filtro de "chunks triviales" para evitar bucles infinitos en la GPU con signos de puntuación aislados.

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

## v0.3.0 - Soporte Multi-GPU (NVIDIA CUDA)
*Fecha: 2026-03-09*

Hemos alcanzado la compatibilidad universal de hardware. VoxLibrix ahora puede correr en GPUs NVIDIA domésticas (como la RTX 5060) con la misma eficiencia que en la nube.

### 7. Soporte Nativo NVIDIA RTX
- **Dockerfiles por Arquitectura**: Separación de `Dockerfile.amd` y `Dockerfile.nvidia` para optimizar PyTorch según el hardware.
- **Perfiles de Docker Compose**: Implementación de `--profile nvidia` y `--profile amd`.
- **Network Aliasing**: Uso de alias de red (`tts-engine`) para que el Backend sea agnóstico del motor que se esté ejecutando.
- **Soporte Windows 11**: Configuración optimizada para WSL2, permitiendo el uso de GPUs Blackwell (RTX Serie 50).

---

### Estado de Infraestructura
- **Local (NVIDIA)**: Docker con CUDA 12.1 (Máximo rendimiento, coste 0€).
- **Local (AMD/CPU)**: Docker con entorno CPU fallback.
- **Cloud**: Modal.com (Pago por uso).

### Roadmap Actualizado
- [x] **Soporte NVIDIA CUDA**: Motor listo para GPUs RTX.
- [x] **Perfiles de Despliegue**: Un solo comando para cualquier S.O.
- [ ] **Batch Processing (Súper Ahorro)**: Implementación final en el motor local (actualmente solo en Cloud).
- [ ] **Soporte EPUB**: Parser automático de libros electrónicos.
- [ ] **Multi-Tenancy**: Gestión de perfiles de usuario.
