import asyncio
import os
from database import AsyncSessionLocal
import models
from services.generator import _merge

async def force_merge(audiobook_id: int):
    out_dir = f"/data/output/{audiobook_id}"
    print(f"Forzando mezcla para audiolibro {audiobook_id} en {out_dir}")
    try:
        await _merge(audiobook_id, out_dir)
        print("✅ Mezcla completada con éxito")
    except Exception as e:
        print(f"❌ Error durante la mezcla: {e}")

if __name__ == "__main__":
    import sys
    ab_id = int(sys.argv[1]) if len(sys.argv) > 1 else 76
    asyncio.run(force_merge(ab_id))
