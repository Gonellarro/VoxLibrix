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

## v0.3.1 - Estabilidad y Visión de Plataforma
*Fecha: 2026-03-09*

Tras las pruebas de carga, hemos decidido priorizar la experiencia de usuario y la estabilidad sobre el ahorro marginal de costes.

### 8. Simplificación y Estabilidad Cloud
- **Reversión de Lotes (Batching)**: Se ha eliminado el envío de fragmentos en lote (8 a la vez). Aunque ahorraba un ~10% de coste, provocaba tiempos de espera de 7-8 minutos sin feedback visual y riesgo de *time-outs* en Modal.
- **Fluidez "Real-Time"**: Volvemos a la generación fragmento a fragmento, garantizando que el usuario vea progreso constante en la interfaz.

### 9. Nueva Visión: VoxLibrix Professional
El proyecto pivota de ser un "creador de MP3s" a una **Plataforma de Conocimiento Técnico**.
- **Enfoque en Oposiciones/Medicina/Legal**: Especialización de voces y estructuras para textos técnicos extensos.
- **Ecosistema de Consumo**: El objetivo no es solo generar el archivo, sino ofrecer una interfaz estilo **iVoox/Audible** sincronizada entre dispositivos (PWA).

---

### Estado de Infraestructura
- **Local (NVIDIA)**: Docker con CUDA 12.1 (Optimizado para RTX 5060, coste 0€).
- **Local (AMD/CPU)**: Entorno de compatibilidad.
- **Cloud**: Modal.com (Producción con GPU L4 Turbo).

### Roadmap: La Ruta hacia el SaaS
- [x] **Arquitectura Multi-Engine**: Listo para correr en cualquier PC o Servidor.
- [ ] **Sistema de Usuarios & Auth**: Sincronización de bibliotecas privadas.
- [ ] **Reproductor PWA**: Interfaz móvil para escuchar en movimiento (Coche/GYM).
- [ ] **Ingesta de PDFs Técnicos**: Parser inteligente de apuntes y leyes.

---

## v0.4.0 - Multi-Voz Pro & Mobile UX
*Fecha: 2026-03-16*

Hemos dado un salto cualitativo en la capacidad narrativa del sistema, permitiendo ahora la creación de audiolibros con múltiples personajes y voces, además de profesionalizar la interfaz móvil.

### 10. Narrativa Multi-Personaje (Pepe & Co.)
- **Soporte XML Nativo**: El sistema ahora parsea etiquetas tipo `<Personaje>texto</Personaje>`.
- **Mapeo de Voces en Estudio**: Interfaz para asignar voces clonadas específicas a cada personaje detectado en el libro.
- **Visualización de Badges Cromáticos**: 
    - En la biblioteca, el texto se formatea automáticamente sustituyendo las etiquetas XML por insignias de colores.
    - **Cromática Consistente**: Un algoritmo asigna el mismo color a un personaje en todo el libro, facilitando la lectura visual.
- **Gestión Avanzada de Silencios**:
    - Pausa por cambio de voz (1.0s) para marcar transiciones entre personajes.
    - Pausa por punto y aparte (1.0s) para una respiración más natural.
    - Pausa estándar entre frases (0.5s) para mantener el ritmo narrativo.
    - Limpieza inteligente de puntuación residual en etiquetas XML para evitar pausas dobles.

### 11. Refinamiento Mobile-First (Responsive)
- **Diseño de Tarjetas Evolucionado**: Sincronización de la estructura de las tarjetas del Estudio con las de la Biblioteca, permitiendo altura flexible.
- **Zero-Truncation**: Eliminación de recortes laterales en dispositivos móviles mediante una arquitectura de cuadrícula dinámica.
- **Filtros Simplificados**: Optimización de la barra de herramientas superior para pantallas pequeñas, priorizando los motores (QWEN/PIPER).
- **Corrección de Errores Críticos**:
    - Resolución de fallos asíncronos en base de datos (`MissingGreenlet`) durante la mezcla de audios largos.
    - Optimización de la rejilla de estadísticas (Formato/Palabras/Tiempo) para lectura en dos columnas en móviles.

---

## v0.5.0 - Gestión de Biblioteca Avanzada & Vista de Lista
*Fecha: 2026-03-17*

Hemos centrado esta actualización en la eficiencia operativa de la biblioteca, permitiendo gestionar colecciones grandes con mayor comodidad y simplificando la ingesta de nuevos contenidos.

### 12. Interfaz de Alta Densidad (List View)
- **Modo Lista Global**: Implementación de un selector de vista (Cuadrícula/Lista) en las secciones de **Biblioteca**, **Estudio** y **Voces**.
- **Persistencia de Preferencia**: El sistema recuerda el modo de vista elegido por el usuario para cada sección mediante `localStorage`.
- **Diseño de Fila Única**: 
    - Optimización de espacio para mostrar título, autor, etiquetas y metadatos en una sola línea.
    - Acciones rápidas (Editar, Reproducir, Eliminar, Descargar) accesibles sin necesidad de abrir menús.
- **Sincronización de Estilos**: Consistencia visual entre el modo lista de libros, audiolibros y voces clonadas/Piper.

### 13. Ingesta de Metadatos en un Solo Paso
- **Modal de Creación Extendido**: Ahora es posible definir metadatos críticos en el momento de la subida:
    - **Título y Autor**: Selección manual o edición de los datos extraídos del EPUB.
    - **Carga de Portada**: Subida directa de imagen de carátula junto con el archivo (.epub/.txt).
    - **Asignación de Etiquetas**: Selector de tags integrado en el proceso de creación.
- **Datalist de Autores**: Sugerencia automática de autores ya existentes para mantener la base de datos limpia.
- **Prioridad de Usuario**: El sistema ahora respeta los metadatos introducidos manualmente sobre los automáticos detectados en archivos EPUB.

### 14. Mejoras Técnicas & Backend
- **Nuevos Endpoints**: Actualización de la API de Libros para procesar formularios multipart con título, autor y portada simultáneamente.
- **Gestión de Archivos**: Sistema balanceado para ignorar o sobreescribir portadas extraídas según la acción del usuario.
- **Optimización de Carga**: Mejora en el refresco de componentes tras la creación o edición masiva.

