from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

import os
from fastapi.staticfiles import StaticFiles
from database import AsyncSessionLocal
import models
from routers import voices, books, audiobooks, authors, admin

DATA_DIR = os.environ.get("DATA_DIR", "/data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Al arrancar: resetear audiolibros que quedaron en 'processing' (reinicio de servidor)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(models.Audiobook)
            .where(models.Audiobook.status == "processing")
            .values(status="pending")
        )
        await db.commit()
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

# Portadas de libros
covers_path = os.path.join(DATA_DIR, "covers")
os.makedirs(covers_path, exist_ok=True)
app.mount("/covers", StaticFiles(directory=covers_path), name="covers")


@app.get("/health")
async def health():
    return {"status": "ok"}
