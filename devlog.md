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

---

## 🔮 Roadmap / Futuro (No implementado)

- **Aceleración GPU (CUDA/NVIDIA)**: Pendiente de implementación y pruebas de estabilidad.
- **Integración Cloud**: Pruebas conceptuales con Modal.com (actualmente no operativas).
- **Sistema de Usuarios**: Sincronización de bibliotecas y perfiles personales.
- **Reproductor PWA**: Interfaz de escucha optimizada para consumo móvil offline.
