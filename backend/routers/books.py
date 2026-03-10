import os
import re
import uuid
from typing import Optional
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
    txt_file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    author_id: Optional[int] = Form(None),
    type: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # Valores por defecto si no vienen en el Form
    if not type:
        type = "single_voice"

    books_dir = os.path.join(DATA_DIR, "books")
    os.makedirs(books_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}.txt"
    path = os.path.join(books_dir, filename)
    content = await txt_file.read()
    
    word_count = 0
    metadata = {}
    cover_path = None

    if txt_file.filename.lower().endswith('.epub'):
        # --- PROCESAMIENTO EPUB ---
        import ebooklib
        from ebooklib import epub
        from bs4 import BeautifulSoup
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            book_epub = epub.read_epub(tmp_path)
            
            # 1. Extraer Texto y contar palabras
            full_text = []
            for item in book_epub.get_items_of_type(ebooklib.ITEM_DOCUMENT):
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                full_text.append(soup.get_text())
            
            clean_text = "\n\n".join(full_text)
            word_count = len(clean_text.split())
            
            # Guardamos el texto extraído como el archivo de referencia .txt
            with open(path, "w", encoding="utf-8") as f:
                f.write(clean_text)

            # 2. Metadatos
            metadata['title'] = book_epub.get_metadata('DC', 'title')[0][0] if book_epub.get_metadata('DC', 'title') else None
            metadata['author'] = book_epub.get_metadata('DC', 'creator')[0][0] if book_epub.get_metadata('DC', 'creator') else ""
            metadata['publisher'] = book_epub.get_metadata('DC', 'publisher')[0][0] if book_epub.get_metadata('DC', 'publisher') else ""
            
            # 2b. Crear/buscar Author si tenemos nombre
            if metadata['author']:
                author_name = metadata['author'].strip()
                existing = await db.execute(
                    select(models.Author).where(models.Author.name == author_name)
                )
                author_obj = existing.scalars().first()
                if not author_obj:
                    author_obj = models.Author(name=author_name)
                    db.add(author_obj)
                    await db.flush()  # Para obtener el ID
                author_id = author_obj.id
            
            # 3. Portada — múltiples estrategias
            covers_dir = os.path.join(DATA_DIR, "covers")
            os.makedirs(covers_dir, exist_ok=True)
            
            cover_item = None
            
            # Estrategia A: buscar por metadata cover-image del EPUB
            cover_meta = book_epub.get_metadata('OPF', 'cover')
            if cover_meta:
                cover_id = cover_meta[0][1].get('content', '') if len(cover_meta[0]) > 1 else ''
                if cover_id:
                    for item in book_epub.get_items():
                        if item.get_id() == cover_id:
                            cover_item = item
                            break
            
            # Estrategia B: buscar por nombre que contenga 'cover'
            if not cover_item:
                for item in book_epub.get_items_of_type(ebooklib.ITEM_IMAGE):
                    if 'cover' in item.get_name().lower():
                        cover_item = item
                        break
            
            # Estrategia C: buscar por propiedad cover-image en spine/manifest
            if not cover_item:
                for item in book_epub.get_items_of_type(ebooklib.ITEM_COVER):
                    cover_item = item
                    break
            
            # Estrategia D: primera imagen del EPUB (mayor de 10KB, probablemente la portada)
            if not cover_item:
                for item in book_epub.get_items_of_type(ebooklib.ITEM_IMAGE):
                    if len(item.get_content()) > 10000:  # >10KB
                        cover_item = item
                        break
            
            if cover_item:
                ext = os.path.splitext(cover_item.get_name())[1] or ".jpg"
                cover_filename = f"{uuid.uuid4()}{ext}"
                cover_path_abs = os.path.join(covers_dir, cover_filename)
                with open(cover_path_abs, "wb") as f:
                    f.write(cover_item.get_content())
                cover_path = f"/covers/{cover_filename}"
        finally:
            os.remove(tmp_path)
    else:
        # --- PROCESAMIENTO TXT ---
        with open(path, "wb") as f:
            f.write(content)
        word_count = len(content.decode("utf-8", errors="ignore").split())

    # Fallback del título: metadatos EPUB > form > nombre del archivo
    final_title = metadata.get('title') or title or os.path.splitext(txt_file.filename)[0]

    book = models.Book(
        title=final_title,
        author_id=author_id,
        txt_path=path,
        type=type,
        word_count=word_count,
        publisher=metadata.get('publisher'),
        cover_path=cover_path
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


@router.get("/{book_id}/text")
async def get_book_text(book_id: int, db: AsyncSession = Depends(get_db)):
    """Devuelve el contenido de texto extraído del libro."""
    b = await db.get(models.Book, book_id)
    if not b:
        raise HTTPException(404, "Libro no encontrado")
    if not b.txt_path or not os.path.exists(b.txt_path):
        raise HTTPException(404, "Archivo de texto no encontrado")
    with open(b.txt_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Limpiar saltos de línea excesivos (Máximo 2 líneas en blanco)
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    
    return {"text": text}


@router.patch("/{book_id}", response_model=schemas.BookResponse)
async def update_book(
    book_id: int,
    title: Optional[str] = Form(None),
    author_id: Optional[int] = Form(None),
    author_name: Optional[str] = Form(None),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    book = await db.get(models.Book, book_id)
    if not book:
        raise HTTPException(404, "Libro no encontrado")
    
    if title:
        book.title = title
    
    if author_name:
        author_name = author_name.strip()
        existing = await db.execute(
            select(models.Author).where(models.Author.name == author_name)
        )
        author_obj = existing.scalars().first()
        if not author_obj:
            author_obj = models.Author(name=author_name)
            db.add(author_obj)
            await db.flush()
        book.author_id = author_obj.id
    elif author_id is not None:
        book.author_id = author_id
        
    if cover:
        covers_dir = os.path.join(DATA_DIR, "covers")
        os.makedirs(covers_dir, exist_ok=True)
        ext = os.path.splitext(cover.filename)[1] or ".jpg"
        cover_filename = f"{uuid.uuid4()}{ext}"
        cover_path_abs = os.path.join(covers_dir, cover_filename)
        
        content = await cover.read()
        with open(cover_path_abs, "wb") as f:
            f.write(content)
        
        # Eliminar portada vieja si existe
        if book.cover_path:
            old_path = os.path.join(DATA_DIR, book.cover_path.lstrip("/"))
            if os.path.exists(old_path):
                try: os.remove(old_path)
                except: pass
                
        book.cover_path = f"/covers/{cover_filename}"
        
    await db.commit()
    
    # Recargar relaciones
    result = await db.execute(
        select(models.Book)
        .options(selectinload(models.Book.author))
        .where(models.Book.id == book_id)
    )
    return result.scalar_one()


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
