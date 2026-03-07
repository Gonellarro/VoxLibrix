from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import models, schemas
from database import get_db

router = APIRouter()

@router.get("", response_model=List[schemas.AuthorResponse])
async def list_authors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Author).order_by(models.Author.name))
    return result.scalars().all()

@router.post("", response_model=schemas.AuthorResponse)
async def create_author(author: schemas.AuthorCreate, db: AsyncSession = Depends(get_db)):
    db_author = models.Author(**author.model_dump())
    db.add(db_author)
    await db.commit()
    await db.refresh(db_author)
    return db_author

@router.get("/{author_id}", response_model=schemas.AuthorResponse)
async def get_author(author_id: int, db: AsyncSession = Depends(get_db)):
    author = await db.get(models.Author, author_id)
    if not author:
        raise HTTPException(404, "Escritor no encontrado")
    return author

@router.put("/{author_id}", response_model=schemas.AuthorResponse)
async def update_author(author_id: int, author_update: schemas.AuthorCreate, db: AsyncSession = Depends(get_db)):
    db_author = await db.get(models.Author, author_id)
    if not db_author:
        raise HTTPException(404, "Escritor no encontrado")
    
    for key, value in author_update.model_dump().items():
        setattr(db_author, key, value)
        
    await db.commit()
    await db.refresh(db_author)
    return db_author

@router.delete("/{author_id}")
async def delete_author(author_id: int, db: AsyncSession = Depends(get_db)):
    author = await db.get(models.Author, author_id)
    if not author:
        raise HTTPException(404, "Escritor no encontrado")
    await db.delete(author)
    await db.commit()
    return {"ok": True}
