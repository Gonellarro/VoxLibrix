from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update, select

import os
from fastapi.staticfiles import StaticFiles
from database import AsyncSessionLocal
import models
from routers import voices, books, audiobooks, authors, admin, tags, openai

DATA_DIR = os.environ.get("DATA_DIR", "/data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Crear tablas si no existen
    from database import Base, engine
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("Estructura de base de datos verificada/creada.")
    except Exception as e:
        print(f"Error creando esquema inicial: {e}")

    # 1b. Seed Tags iniciales
    try:
        async with AsyncSessionLocal() as db:
            initial_tags = [
                {"name": "pendiente", "color": "#FF9800"},
                {"name": "favorito", "color": "#E91E63"},
                {"name": "QWEN", "color": "#4CAF50"},
                {"name": "PIPER", "color": "#9C27B0"},
            ]
            for tag_data in initial_tags:
                result = await db.execute(select(models.Tag).where(models.Tag.name == tag_data["name"]))
                if not result.scalars().first():
                    tag = models.Tag(**tag_data)
                    db.add(tag)
            await db.commit()
    except Exception as e:
        print(f"Error sembrando tags iniciales: {e}")

    # 2. Resetear estados de procesos interrumpidos y recuperar cola
    from services import generator
    try:
        await generator.bootstrap()
    except Exception as e:
        print(f"Aviso de arranque: No se pudo recuperar la cola: {e}")
    yield


app = FastAPI(
    title="Audiobook Generator API",
    description="Backend para generación de audiolibros con clonación de voz",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router, prefix="/admin", tags=["Administración"])
app.include_router(authors.router, prefix="/authors", tags=["Escritores"])
app.include_router(voices.router, prefix="/voices", tags=["Voces"])
app.include_router(books.router, prefix="/books", tags=["Libros"])
app.include_router(audiobooks.router, prefix="/audiobooks", tags=["Audiolibros"])
app.include_router(tags.router, prefix="/tags", tags=["Etiquetas"])
app.include_router(openai.router, prefix="/v1", tags=["OpenAI Compatibility"])
app.include_router(openai.router, tags=["OpenAI Root Compatibility"])

# Portadas de libros
covers_path = os.path.join(DATA_DIR, "covers")
os.makedirs(covers_path, exist_ok=True)
app.mount("/covers", StaticFiles(directory=covers_path), name="covers")


@app.get("/health")
async def health():
    return {"status": "ok"}
