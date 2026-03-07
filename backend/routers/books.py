import os
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models, schemas
from database import get_db

router = APIRouter()
DATA_DIR = os.environ.get("DATA_DIR", "/data")


from sqlalchemy.orm import selectinload


@router.get("", response_model=list[schemas.BookResponse])
async def list_books(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Book)
        .options(selectinload(models.Book.author))
        .order_by(models.Book.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=schemas.BookResponse)
async def create_book(
    title: str = Form(...),
    author_id: int = Form(None),
    type: str = Form(...),
    txt_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if type not in ("single_voice", "multi_voice"):
        raise HTTPException(400, "type debe ser single_voice o multi_voice")

    books_dir = os.path.join(DATA_DIR, "books")
    os.makedirs(books_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}.txt"
    path = os.path.join(books_dir, filename)
    content = await txt_file.read()
    with open(path, "wb") as f:
        f.write(content)

    book = models.Book(
        title=title,
        author_id=author_id,
        txt_path=path,
        type=type,
    )
    db.add(book)
    await db.commit()
    
    # Recargar con la relación author para el response
    result = await db.execute(
        select(models.Book)
        .options(selectinload(models.Book.author))
        .where(models.Book.id == book.id)
    )
    return result.scalar_one()


@router.get("/{book_id}", response_model=schemas.BookResponse)
async def get_book(book_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Book)
        .options(selectinload(models.Book.author))
        .where(models.Book.id == book_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(404, "Libro no encontrado")
    return b


@router.get("/{book_id}/tags")
async def get_tags(book_id: int, db: AsyncSession = Depends(get_db)):
    """Devuelve los tags únicos encontrados en un libro multi_voice."""
    b = await db.get(models.Book, book_id)
    if not b:
        raise HTTPException(404, "Libro no encontrado")
    if b.type != "multi_voice":
        return {"tags": []}
    try:
        with open(b.txt_path, "r", encoding="utf-8") as f:
            content = f.read()
        tags = list(dict.fromkeys(
            m.group(1).strip()
            for m in re.finditer(r'^\[([^\]]+)\]', content, re.MULTILINE)
        ))
        return {"tags": tags}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/{book_id}")
async def delete_book(book_id: int, db: AsyncSession = Depends(get_db)):
    b = await db.get(models.Book, book_id)
    if not b:
        raise HTTPException(404, "Libro no encontrado")
    if b.txt_path and os.path.exists(b.txt_path):
        try:
            os.remove(b.txt_path)
        except OSError:
            pass
    await db.delete(b)
    await db.commit()
    return {"ok": True}
