import asyncio
from sqlalchemy import text
from database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE audiobook ADD COLUMN start_char INTEGER;"))
            await conn.execute(text("ALTER TABLE audiobook ADD COLUMN end_char INTEGER;"))
            print("✅ Columnas start_char y end_char añadidas a la tabla audiobook")
        except Exception as e:
            print(f"❌ Error o las columnas ya existen: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
