from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from database import get_db
import models, schemas

router = APIRouter()

@router.get("", response_model=List[schemas.TagResponse])
async def get_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Tag).order_by(models.Tag.name))
    return result.scalars().all()

@router.post("", response_model=schemas.TagResponse)
async def create_tag(tag: schemas.TagCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Tag).where(models.Tag.name == tag.name))
    db_tag = result.scalars().first()
    if db_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    new_tag = models.Tag(name=tag.name, color=tag.color)
    db.add(new_tag)
    await db.commit()
    await db.refresh(new_tag)
    return new_tag

@router.delete("/{tag_id}")
async def delete_tag(tag_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Tag).where(models.Tag.id == tag_id))
    db_tag = result.scalars().first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    await db.delete(db_tag)
    await db.commit()
    return {"message": "Tag deleted"}

@router.post("/books/{book_id}", response_model=schemas.BookResponse)
async def link_tag_to_book(book_id: int, tag_link: schemas.TagLink, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Book)
        .options(selectinload(models.Book.tags), selectinload(models.Book.author))
        .where(models.Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    result = await db.execute(select(models.Tag).where(models.Tag.id == tag_link.tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if tag not in book.tags:
        book.tags.append(tag)
        await db.commit()
        await db.refresh(book)
    
    return book

@router.delete("/books/{book_id}/{tag_id}", response_model=schemas.BookResponse)
async def unlink_tag_from_book(book_id: int, tag_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Book)
        .options(selectinload(models.Book.tags), selectinload(models.Book.author))
        .where(models.Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    result = await db.execute(select(models.Tag).where(models.Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if tag in book.tags:
        book.tags.remove(tag)
        await db.commit()
        await db.refresh(book)
    
    return book

@router.post("/audiobooks/{audiobook_id}", response_model=schemas.AudiobookResponse)
async def link_tag_to_audiobook(audiobook_id: int, tag_link: schemas.TagLink, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Audiobook)
        .options(selectinload(models.Audiobook.tags))
        .where(models.Audiobook.id == audiobook_id)
    )
    audiobook = result.scalar_one_or_none()
    if not audiobook:
        raise HTTPException(status_code=404, detail="Audiobook not found")
    
    result = await db.execute(select(models.Tag).where(models.Tag.id == tag_link.tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if tag not in audiobook.tags:
        audiobook.tags.append(tag)
        await db.commit()
        await db.refresh(audiobook)
    
    return audiobook

@router.delete("/audiobooks/{audiobook_id}/{tag_id}", response_model=schemas.AudiobookResponse)
async def unlink_tag_from_audiobook(audiobook_id: int, tag_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Audiobook)
        .options(selectinload(models.Audiobook.tags))
        .where(models.Audiobook.id == audiobook_id)
    )
    audiobook = result.scalar_one_or_none()
    if not audiobook:
        raise HTTPException(status_code=404, detail="Audiobook not found")
    
    result = await db.execute(select(models.Tag).where(models.Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    if tag in audiobook.tags:
        audiobook.tags.remove(tag)
        await db.commit()
        await db.refresh(audiobook)
    
    return audiobook
