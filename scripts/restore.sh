#!/bin/bash

# VoxLibrix - Script de Restauración
# Uso: ./scripts/restore.sh backups/archivo_backup.tar.gz

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: Debes especificar el archivo de backup."
    echo "Uso: $0 backups/voxlibrix_backup_XXXXXXXX_XXXXXX.tar.gz"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: El archivo '$BACKUP_FILE' no existe."
    exit 1
fi

echo "⚠️  ¡ATENCIÓN! Esto sobreescribirá tus datos actuales (voces, libros y base de datos)."
read -p "¿Estás seguro de que quieres continuar? (s/n): " confirm
if [[ $confirm != [sS] ]]; then
    echo "Aportado."
    exit 1
fi

echo "🛑 Deteniendo servicios..."
docker compose down

echo "📦 Extrayendo archivos del backup..."
# Extraemos en una carpeta temporal para no romper nada antes de tiempo
TEMP_DIR="/tmp/voxlibrix_restore_$(date +%s)"
mkdir -p "$TEMP_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restaurar la carpeta data (excepto modelos si ya existen)
echo "📂 Restaurando carpeta de datos (voces, libros, etc)..."
if [ -d "data" ]; then
    # Si existe data, la movemos a un backup temporal por si acaso
    mv data data_pre_restore_$(date +%s)
fi

# El backup de admin.py tiene 'data' en la raíz del tar
if [ -d "$TEMP_DIR/data" ]; then
    mv "$TEMP_DIR/data" ./data
else
    # Si el backup se hizo con el script manual, la estructura puede variar levemente
    # Intentamos encontrar la carpeta data
    find "$TEMP_DIR" -type d -name "data" -exec mv {} ./data \;
fi

# Si teníamos modelos descargados, los movemos de vuelta (ya que el backup los excluye)
PRE_RESTORE_DIR=$(ls -d data_pre_restore_* 2>/dev/null | tail -n 1)
if [ -n "$PRE_RESTORE_DIR" ] && [ -d "$PRE_RESTORE_DIR/models" ]; then
    echo "🧠 Manteniendo modelos de IA existentes..."
    mkdir -p data/models
    cp -rn "$PRE_RESTORE_DIR/models/"* data/models/ 2>/dev/null
fi

echo "🐘 Levantando base de datos para restauración..."
docker compose up -d postgres

echo "⏳ Esperando a que Postgres esté listo..."
until docker exec audiobook-postgres pg_isready -U audio_user -d audiobooks > /dev/null 2>&1; do
  sleep 1
done

echo "💾 Importando base de datos SQL..."
SQL_FILE=$(find "$TEMP_DIR" -name "*.sql" | head -n 1)
if [ -n "$SQL_FILE" ]; then
    cat "$SQL_FILE" | docker exec -i audiobook-postgres psql -U audio_user -d audiobooks
    echo "✅ Base de datos importada."
else
    echo "❌ Error: No se encontró archivo SQL en el backup."
fi

echo "🚀 Iniciando resto de servicios..."
docker compose up -d

echo "🧹 Limpiando archivos temporales..."
rm -rf "$TEMP_DIR"

echo "✨ ¡Restauración completada con éxito!"
echo "--------------------------------------------------------"
echo "Nota: Se ha guardado una copia de tu carpeta 'data' antigua en: $PRE_RESTORE_DIR (puedes borrarla si todo funciona bien)"
