import asyncio
from sqlalchemy import select, func
from database import AsyncSessionLocal
import models

async def check_status():
    async with AsyncSessionLocal() as db:
        # Buscamos audiolibros que no estén en estado 'done'
        result = await db.execute(select(models.Audiobook).where(models.Audiobook.status != 'done'))
        audiobooks = result.scalars().all()
        
        for ab in audiobooks:
            print(f"ID: {ab.id}, Status: {ab.status}, Progress: {ab.completed_chunks}/{ab.total_chunks}")
            print(f"  Error Message: {ab.error_message}")
            print(f"  Final Audio Path: {ab.final_audio_path}")
            
            # Contar estados de chunks
            result_chunks = await db.execute(
                select(models.AudioChunk.status, func.count(models.AudioChunk.id))
                .where(models.AudioChunk.audiobook_id == ab.id)
                .group_by(models.AudioChunk.status)
            )
            for status, count in result_chunks.all():
                print(f"  Chunk Status {status}: {count}")


if __name__ == "__main__":
    asyncio.run(check_status())
