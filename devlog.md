# DevLog - VoxLibrix

## Estado: Versión Inicial Funcional (v1.0.0)
*Fecha: 2026-02-28*

Este proyecto es un generador de audiolibros local que utiliza el modelo **Qwen3-TTS** para clonación de voz y síntesis de audio de alta calidad.

### Hitos Alcanzados
- **Arquitectura Base**: Microservicios dockerizados (Frontend React, Backend FastAPI, TTS Engine PyTorch).
- **Gestión de Voces**: Clonación de voz mediante muestras de 10-15s.
- **Generación Robusta**: Segmentación de texto, guardado incremental (Safe-Save) y autodescarga.

---

## v0.4.0 - Multi-Voz Pro & Mobile UX
*Fecha: 2026-03-16*

Salto cualitativo en la capacidad narrativa del sistema, permitiendo audiolibros con múltiples personajes y profesionalizando la interfaz móvil.

### Hitos Alcanzados
- **Narrativa Multi-Personaje**: Soporte para etiquetas XML (`<Personaje>...`) y mapeo de voces en el Estudio.
- **Gestión de Silencios**: Pausas diferenciadas por personaje, párrafo y frase para mayor naturalidad.
- **Refinamiento Mobile-First**: Layout responsive, eliminación de recortes laterales y visualización optimizada de estadísticas en móviles.

---

## v0.5.0 - Gestión de Biblioteca Avanzada & Vista de Lista
*Fecha: 2026-03-17*

En esta versión nos centramos en la eficiencia de la biblioteca y la facilidad de uso para el usuario al añadir nuevos libros.

### Hitos Alcanzados
- **Interfaz de Alta Densidad (List View)**: Selector de vista Cuadrícula/Lista con persistencia por localStorage en Biblioteca, Estudio y Voces.
- **Metadatos en un solo paso**: Nueva interfaz para definir Título, Autor, Portada y Etiquetas directamente en el modal de subida.
- **Datalist de Autores**: Sugerencias automáticas de autores existentes para evitar duplicados.
- **Motor CPU Estándar**: Unificación del motor genérico bajo el perfil `cpu` para evitar confusiones de arquitectura.
- **Retorno a la Nube (Modal.com)**: Recuperación del botón de generación en la nube para equipos con recursos limitados (como el N100).

---

## v0.6.0 - Configuración Universal & Estabilidad
*Fecha: 2026-03-21*

Versión centrada en la robustez de la configuración y la compatibilidad con diferentes tipos de hardware (CPU, AMD, NVIDIA).

### Hitos Alcanzados
- **Sistema de Perfiles (Docker Profiles)**: Los motores de IA ahora se gestionan mediante perfiles (`cpu`, `rocm`, `nvidia`) unificados bajo el alias `tts-engine`.
- **Configuración centralizada (.env)**: Migración de variables de entorno de `docker-compose.yml` a un archivo `.env` externo, facilitando la personalización y ocultando URLs técnicas.
- **Auto-perfilado**: Uso de `COMPOSE_PROFILES` en el `.env` para que `docker compose up -d` arranque automáticamente el motor deseado sin parámetros extra.
- **Compatibilidad AMD (Ryzen 8845HS)**: Identificación del modo `cpu` como el más estable para hardware AMD debido a inestabilidades detectadas en los drivers ROCm actuales (Kernel < 7).
- **Control de Error en Borrado**: Los 500 al borrar voces en uso ahora se capturan y devuelven un mensaje explicativo al usuario indicando que la voz está vinculada a audiolibros.
- **Cloud TTS Sync**: Mejora en la sincronización de la generación en la nube, moviendo las pruebas de voz (`/test`) al motor local para mayor velocidad de iteración.

---

## v0.6.1 - CPU Opt-Stability & Vulkan Post-Mortem
*Fecha: 2026-03-26*

Versión de estabilización tras intentar la integración de motores Vulkan para hardware AMD (Ryzen 780M). Lecciones aprendidas sobre la madurez de los runtimes de Rust y la superioridad de la CPU Zen4 para inferencia determinista.

### Hitos Alcanzados
- **Estabilización de Precisión (Float32)**: Migración forzada a `float32` en el motor de CPU para eliminar errores de `NaN/inf` (RuntimeError) detectados en cálculos `bfloat16` bajo carga intensa en procesadores AMD Zen4.
- **Detección Automática de Dispositivo**: Ajuste en el script `servidor_tts.py` para garantizar que PyTorch use explícitamente el backend `cpu` de forma estable.
- **Lección Aprendida (Vulkan/AMD)**: Se descarta la integración de `qwen3-tts-rust` vía Vulkan debido a inestabilidades críticas en la inicialización de ONNX Runtime (`deadlocks` en drivers de video) y la falta de soporte nativo para Linux/AMD en los repositorios actuales orientados a NVIDIA.
- **Eficiencia de Memoria**: Límite de RAM optimizado a 8GB para el servicio `tts-engine-cpu`, suficiente para el modelo 0.6B Base con clonación de voz ICL.

---

## 🔮 Roadmap / Futuro (No implementado)

- **Aceleración GPU (NVIDIA RTX 5060)**: Pendiente de pulido de los drivers CUDA en Docker para esta serie.
- **Sistema de Usuarios**: Sincronización de bibliotecas y perfiles personales.
- **Reproductor PWA**: Interfaz de escucha optimizada para consumo móvil offline.

