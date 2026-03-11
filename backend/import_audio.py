import os
import asyncio
import shutil
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from datetime import datetime

# Añadir el path del backend para poder importar modulos
import sys
sys.path.append(os.path.join(os.getcwd(), 'backend'))

import models
from database import AsyncSessionLocal
from services import generator

IMPORT_DIR = "/data/import"
DATA_DIR = os.environ.get("DATA_DIR", "/data")
NARRATOR_NAME = "Constantino Romero"
ENGINE = "qwen"

# Mapeo manual de nombres de archivo a títulos en BBDD para mayor precisión
FILE_MAP = {
    "ElColosoNegro.mp3": "El coloso negro",
    "LaHijaDelGiganteHelado.mp3": "La hija del gigante helado",
    "LaTorreDelElefante.mp3": "La torre del elefante"
}

async def import_files():
    async with AsyncSessionLocal() as db:
        # 1. Buscar la voz de Constantino
        res_voice = await db.execute(select(models.Voice).where(models.Voice.name == NARRATOR_NAME))
        voice = res_voice.scalar_one_or_none()
        if not voice:
            print(f"❌ Error: No se encontró la voz '{NARRATOR_NAME}'")
            return

        for filename, book_title in FILE_MAP.items():
            file_path = os.path.join(IMPORT_DIR, filename)
            if not os.path.exists(file_path):
                print(f"⚠️ Saltando {filename}: no existe en data/import")
                continue

            # 2. Buscar el libro
            res_book = await db.execute(
                select(models.Book).options(selectinload(models.Book.author)).where(models.Book.title.ilike(f"%{book_title}%"))
            )
            book = res_book.scalar_one_or_none()
            if not book:
                print(f"❌ Error: No se encontró el libro '{book_title}'")
                continue

            print(f"📦 Importando '{book_title}'...")

            # 3. Crear el audiolibro
            ab = models.Audiobook(
                book_id=book.id,
                narrator_voice_id=voice.id,
                engine=ENGINE,
                engine_voice_id=NARRATOR_NAME,
                output_format="mp3",
                status="done",
                total_words=book.word_count or 0,
                finished_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                started_at=datetime.utcnow()
            )
            db.add(ab)
            await db.flush() # Para obtener el ID

            # 4. Preparar carpetas
            dest_dir = os.path.join(DATA_DIR, "output", str(ab.id))
            os.makedirs(dest_dir, exist_ok=True)
            
            safe_name = generator.sanitize_filename(book.title)
            dest_path = os.path.join(dest_dir, f"{safe_name}.mp3")

            # 5. Mover archivo
            shutil.move(file_path, dest_path)
            ab.final_audio_path = dest_path

            # 6. Inyectar metadatos ID3
            author_name = book.author.name if book.author else None
            cover_abs = os.path.join(DATA_DIR, book.cover_path.lstrip("/")) if book.cover_path else None
            generator.write_mp3_metadata(dest_path, book, author_name, cover_abs)

            print(f"✅ '{book_title}' importado con ID {ab.id}")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(import_files())
