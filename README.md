# 🎙️ VoxLibrix: AI-Powered Audiobook Generation

**VoxLibrix** es una plataforma de código abierto diseñada para transformar textos y libros en audiolibros de alta fidelidad utilizando los últimos avances en modelos de IA (clonación de voz y síntesis multilingüe).

Nuestro objetivo es democratizar la creación de audiolibros, permitiendo que autores independientes y entusiastas de la lectura generen contenido de audio profesional con su propia voz o voces personalizadas de forma local y privada.

---

## 🚀 Visión del Proyecto

Este proyecto nació como una herramienta personal para la generación de audiolibros de alta calidad, enfocada en la privacidad y el control total del usuario sobre sus datos y voces.

- **Calidad Premium:** Basado en modelos avanzados para una síntesis natural.
- **Clonación de Voz:** Genera audiolibros completos con solo unos segundos de audio de referencia.
- **Privacidad Total:** Todo el procesamiento se realiza localmente en tu propio hardware.
- **Open Source:** Código abierto para fomentar la accesibilidad y la innovación.

---

## 🏗️ Arquitectura

El sistema utiliza una arquitectura de microservicios orquestada con Docker:

1.  **Frontend (React):** Interfaz moderna para la gestión de biblioteca, voces y proyectos (Estudio).
2.  **Backend (FastAPI):** Gestiona la lógica de negocio, segmentación de texto y coordinación de tareas.
3.  **TTS Engine (PyTorch):** Motor de IA optimizado para la síntesis y clonación de voz.

---

## 🛠️ Instalación y Uso (Local)

### 1. Requisitos
- Docker y Docker Compose instalados.
- Al menos 8GB de RAM (16GB recomendado).

### 2. Configuración y Despliegue

 1.  **Configura tu entorno**: Crea y ajusta el archivo `.env` basado en tus necesidades (puedes elegir el perfil de hardware y configurar la generación en la nube).
 2.  **Permisos de Escritura**: El contenedor se ejecuta con un usuario no-root (UID 1000). Para evitar errores de permisos al crear carpetas de datos, ejecuta el script de configuración inicial:
     ```bash
     chmod +x setup.sh && ./setup.sh
     ```
 3.  **Lanzamiento**:
     ```bash
     docker compose up -d
     ```

 > [!TIP]
 > **Hardware AMD**: En procesadores Ryzen con iGPU (como el 8845HS), se recomienda usar el perfil `cpu` en el `.env` para mayor estabilidad por el momento.

### 3. Primeros Pasos
- Accede a `http://localhost:3000`.
- **Voces:** Sube una muestra de audio (10-15s) para crear tu primera voz clonada.
- **Biblioteca:** Sube un archivo `.epub` o `.txt`.
- **Estudio:** Crea un proyecto de audiolibro, elige la voz y ¡empieza a generar!

---

## 🔮 Posibilidades Futuras y Roadmap

Estas son funcionalidades en las que se podría trabajar o que se consideran como posibles evoluciones, aunque actualmente **no están implementadas ni probadas oficialmente**:

- **Aceleración NVIDIA RTX (Serie 40/50):** Optimización avanzada para las últimas tarjetas gráficas.
- **Aceleración AMD (ROCm v6):** Mejorar la compatibilidad con iGPUs de alto rendimiento.
- **Soporte Multi-plataforma:** Optimización específica para Windows/WSL2 y macOS (Apple Silicon).
- **Modelo SaaS:** Sistema de usuarios, autenticación y gestión de suscripciones.
- **Reproductor Móvil PWA:** Interfaz optimizada para escuchar los audiolibros generados desde cualquier dispositivo.

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si tienes ideas para mejorar la interfaz, el motor de IA o la estabilidad del sistema, no dudes en participar.

1. Haz un Fork del proyecto.
2. Crea una rama para tu mejora (`git checkout -b feature/nueva-mejora`).
3. Envía un Pull Request.

---

## 📜 Licencia

Este proyecto está bajo la Licencia **MIT**.

---

*Creado con ❤️ para los amantes de las historias y la tecnología.*
