import os
import subprocess
import shutil
import time
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from fastapi.responses import FileResponse
import httpx
from database import get_db

router = APIRouter()
DATA_DIR = os.environ.get("DATA_DIR", "/data")
BACKUP_DIR = "/app/backups" 
TTS_URL = os.environ.get("TTS_ENGINE_URL", "http://tts-engine:8000")
DB_URL = os.environ.get("DATABASE_URL", "")

@router.post("/backup")
async def create_backup():
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        sql_file = f"/tmp/db_{timestamp}.sql"
        backup_name = f"voxlibrix_backup_{timestamp}.tar.gz"
        final_path = os.path.join(BACKUP_DIR, backup_name)

        # 1. Parsear DATABASE_URL para pg_dump
        # postgresql+asyncpg://user:pass@host/dbname
        clean_url = DB_URL.replace("postgresql+asyncpg://", "")
        creds, rest = clean_url.split("@")
        user, password = creds.split(":")
        host, dbname = rest.split("/")

        # 2. Exportar DB
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        dump_cmd = [
            "pg_dump", "-h", host, "-U", user, "-d", dbname, "-f", sql_file
        ]
        res = subprocess.run(dump_cmd, env=env, capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Error en pg_dump: {res.stderr}")

        # 3. Comprimir solo lo necesario (libros, voces, audio generado)
        # Excluimos explícitamente carpetas pesadas o internas de DB
        tar_cmd = [
            "tar", "-czf", final_path,
            "--exclude=data/models",
            "--exclude=data/postgres",
            "--exclude=data/mysql",
            "--exclude=data/db",
            "-C", "/", "data", 
            "-C", os.path.dirname(sql_file), os.path.basename(sql_file)
        ]
        res = subprocess.run(tar_cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Error en tar: {res.stderr}")

        # Limpiar
        if os.path.exists(sql_file):
            os.remove(sql_file)

        return {"ok": True, "filename": backup_name}
    except Exception as e:
        raise HTTPException(500, f"Error ejecutando backup: {str(e)}")

@router.get("/export")
async def export_data():
    """Genera un backup completo y lo devuelve como descarga directa"""
    try:
        res = await create_backup()
        filename = res["filename"]
        path = os.path.join(BACKUP_DIR, filename)
        return FileResponse(path, filename=filename, media_type="application/gzip")
    except Exception as e:
        raise HTTPException(500, f"Error en exportación: {str(e)}")

@router.post("/import")
async def import_data(file: UploadFile = File(...)):
    """Importa un archivo .tar.gz, restaura archivos y base de datos"""
    temp_tar = f"/tmp/import_{time.time()}.tar.gz"
    extract_dir = f"/tmp/import_extract_{time.time()}"
    
    try:
        # 1. Guardar archivo temporalmente
        with open(temp_tar, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Extraer
        os.makedirs(extract_dir, exist_ok=True)
        # tar -xzf backup.tar.gz -C extract_dir
        res = subprocess.run(["tar", "-xzf", temp_tar, "-C", extract_dir], capture_output=True, text=True)
        if res.returncode != 0:
            raise Exception(f"Error extrayendo tar: {res.stderr}")
            
        # 3. Restaurar Archivos
        # El tar contiene una carpeta 'data'
        shared_data_src = os.path.join(extract_dir, "data")
        if os.path.exists(shared_data_src):
            # Copiar archivos de libros, voces, covers y output
            # Usamos -n en cp o simplemente movemos/copiamos sobreescribiendo
            # Aquí optamos por shutil.copytree con dirs_exist_ok=True (Python 3.8+)
            for item in os.listdir(shared_data_src):
                s = os.path.join(shared_data_src, item)
                d = os.path.join("/", "data", item)
                if os.path.isdir(s):
                    shutil.copytree(s, d, dirs_exist_ok=True)
                else:
                    shutil.copy2(s, d)
        
        # 4. Restaurar base de datos
        # Buscar el archivo .sql en el directorio extraído
        sql_file = None
        for f in os.listdir(extract_dir):
            if f.endswith(".sql"):
                sql_file = os.path.join(extract_dir, f)
                break
        
        if sql_file:
            # Parsear credenciales para psql
            clean_url = DB_URL.replace("postgresql+asyncpg://", "")
            creds, rest = clean_url.split("@")
            user, password = creds.split(":")
            host, dbname = rest.split("/")
            
            env = os.environ.copy()
            env["PGPASSWORD"] = password
            
            # Limpiar tablas actuales (DROP SCHEMA CASCADE es efectivo)
            clean_cmd = ["psql", "-h", host, "-U", user, "-d", dbname, "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"]
            subprocess.run(clean_cmd, env=env, capture_output=True)
            
            # Restaurar
            restore_cmd = ["psql", "-h", host, "-U", user, "-d", dbname, "-f", sql_file]
            res = subprocess.run(restore_cmd, env=env, capture_output=True, text=True)
            if res.returncode != 0:
                 raise Exception(f"Error en psql restore: {res.stderr}")

        return {"ok": True, "message": "Importación completada con éxito"}
        
    except Exception as e:
        raise HTTPException(500, f"Error en importación: {str(e)}")
    finally:
        # Limpiar
        if os.path.exists(temp_tar): os.remove(temp_tar)
        if os.path.exists(extract_dir): shutil.rmtree(extract_dir)

@router.get("/backups")
async def list_backups():
    if not os.path.exists(BACKUP_DIR):
        return []
    files = []
    for f in os.listdir(BACKUP_DIR):
        if f.endswith(".tar.gz"):
            path = os.path.join(BACKUP_DIR, f)
            stat = os.stat(path)
            files.append({
                "filename": f,
                "size": stat.st_size,
                "created_at": stat.st_mtime
            })
    return sorted(files, key=lambda x: x["created_at"], reverse=True)

@router.get("/backups/download/{filename}")
async def download_backup(filename: str):
    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path) or ".." in filename:
        raise HTTPException(404, "Backup no encontrado")
    return FileResponse(path, filename=filename, media_type="application/gzip")

@router.delete("/backups/{filename}")
async def delete_backup(filename: str):
    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path) or ".." in filename:
        raise HTTPException(404, "Backup no encontrado")
    os.remove(path)
    return {"ok": True}

@router.get("/stats")
async def get_stats():
    stats = {}
    
    # 1. Uso de disco de /data
    try:
        total, used, free = shutil.disk_usage(DATA_DIR)
        stats["disk"] = {
            "total": total,
            "used": used,
            "free": free,
            "percent": round((used / total) * 100, 1)
        }
    except:
        stats["disk"] = None
    
    # 2. Salud del motor TTS
    async with httpx.AsyncClient(timeout=2.0) as client:
        try:
            resp = await client.get(f"{TTS_URL}/health") # Probamos el nuevo health endpoint o simplemente root
            stats["tts_engine"] = "online" if resp.status_code == 200 else "error"
        except:
            stats["tts_engine"] = "offline"
            
    return stats
