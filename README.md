# 🎙️ VoxLibrix: AI-Powered Audiobook Generation

**VoxLibrix** es una plataforma de código abierto diseñada para transformar textos y libros en audiolibros de alta fidelidad utilizando los últimos avances en modelos de IA (clonación de voz y síntesis multilingüe).

Nuestro objetivo es democratizar la creación de audiolibros, permitiendo que autores independientes y entusiastas de la lectura generen contenido de audio profesional con su propia voz o voces personalizadas a una fracción del coste de los servicios tradicionales.

---

## 🚀 Visión del Proyecto

Este proyecto nació como una herramienta personal de alta calidad y ahora evoluciona hacia una plataforma **Cloud-Native** y un modelo de **SaaS (Software as a Service)**.

- **Calidad Premium:** Basado en modelos como Qwen3-TTS para una síntesis natural.
- **Clonación de Voz:** Genera audiolibros completos con solo 15 segundos de audio de referencia.
- **Eficiencia:** Procesamiento optimizado para ejecutarse en GPUs de consumo y escalabilidad en la nube.
- **Open Source:** Creemos en el código abierto para mejorar la accesibilidad y la innovación en el sector.

---

## 🏗️ Arquitectura Actual

El sistema está compuesto por tres servicios principales orquestados con Docker:

1.  **Frontend (React/Next.js):** Interfaz moderna y fluida para la gestión de libros, voces y proyectos.
2.  **Backend (FastAPI/Python):** API robusta que gestiona la lógica de segmentación de texto, base de datos y coordinación de tareas.
3.  **TTS Engine (PyTorch):** Motor de inteligencia artificial optimizado para clonación de voz en tiempo real.

---

## 🗺️ Roadmap: El camino a la Nube

Estamos en plena migración para convertir este motor local en un servicio profesional escalable:

- [ ] **Migración a CUDA:** Optimización para GPUs NVIDIA en entornos de producción.
- [ ] **Arquitectura Serverless:** Implementación en plataformas como Modal.com para escalado dinámico.
- [ ] **Gestión de Usuarios y Pagos:** Integración con Auth (Supabase/Firebase) y Stripe para modelos de pago por palabra/libro.
- [ ] **Almacenamiento en la Nube:** Transición de archivos locales a Buckets (Amazon S3) para persistencia externa.

---

## 🛠️ Instalación para Desarrollo (Local)

Para probar el sistema en tu propia máquina:

### 1. Requisitos
- Docker y Docker Compose
- Al menos 8GB de RAM (16GB recomendado para el modelo 1.7B)
- Micrófono o archivo de audio WAV de referencia (5-15 segundos)

### 2. Despliegue rápido (Elige tu arquitectura)

VoxLibrix detecta automáticamente tu hardware mediante perfiles de Docker Compose. Elige el comando según tu tarjeta gráfica:

#### A. NVIDIA (Recomendado - RTX 20/30/40/50)
Ideal para tu **Windows 11 con RTX 5060**. Usa **CUDA 12.1** para generación ultrarrápida y gratuita.

**Pasos para Windows 11:**
1.  **Drivers:** Instala los últimos [Drivers de NVIDIA](https://www.nvidia.com/download/index.aspx).
2.  **WSL2:** Abre una terminal como administrador y ejecuta `wsl --install`. Reinicia el PC.
3.  **Docker Desktop:** Instala [Docker Desktop](https://www.docker.com/products/docker-desktop/) y asegúrate de que en la configuración esté activado el "WSL 2 based engine".
4.  **NVIDIA Container Toolkit:** Dentro de tu consola de WSL2 (ej: Ubuntu), instala el [Toolkit oficial](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).
5.  **Lanzar:**
    ```bash
    docker compose --profile nvidia up --build
    ```

#### B. AMD / CPU (Modo de Compatibilidad)
Si no tienes una NVIDIA, este modo usará la **CPU** (más lento) o la potencia de la **Nube (Modal)** si la tienes configurada.
```bash
docker compose --profile amd up --build
```

### 3. Configuración inicial
- Accede a la interfaz web en `http://localhost:3000`.
- Crea una **Voz** subiendo un audio de 10-15s.
- Crea un **Libro** subiendo un archivo `.txt`.
- ¡Pulsa **Local** (NVIDIA) o **Nube** (AMD) para empezar a generar!

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si eres desarrollador de IA, experto en Backend o amante del diseño UI/UX, ayúdanos a convertir VoxLibrix en la plataforma de referencia para audiolibros.

1. Haz un Fork del proyecto.
2. Crea una rama para tu mejora (`git checkout -b feature/nueva-mejora`).
3. Envía un Pull Request.

---

## 📜 Licencia

Este proyecto está bajo la Licencia **MIT**. Siéntete libre de usarlo, modificarlo y compartirlo.

---

*Creado con ❤️ por el equipo de VoxLibrix para los amantes de las historias.*

