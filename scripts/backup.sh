#!/bin/bash

# Configuración
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
DATA_DIR="./data"
DB_CONTAINER="audiobook-postgres"
DB_USER="audio_user"
DB_NAME="audiobooks"
BACKUP_NAME="voxlibrix_backup_$TIMESTAMP"

echo "🚀 Iniciando backup de VoxLibrix..."

# 1. Crear el volcado SQL de la base de datos
echo "💾 Exportando base de datos..."
docker exec $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/db_$TIMESTAMP.sql"

# 2. Comprimir la carpeta 'data' (voces, libros y audiolibros) junto con el SQL
# Excluimos la carpeta postgres interna porque ya tenemos el SQL dump, que es más seguro
echo "📦 Comprimiendo archivos y voces..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
    --exclude="$DATA_DIR/postgres" \
    "$DATA_DIR" \
    "$BACKUP_DIR/db_$TIMESTAMP.sql" \
    "./docker-compose.yml"

# 3. Limpiar el archivo SQL temporal
rm "$BACKUP_DIR/db_$TIMESTAMP.sql"

echo "✅ Backup completado con éxito: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "--------------------------------------------------------"
echo "Para restaurar, solo tendrías que:"
echo "1. Descomprimir el archivo."
echo "2. Levantar los servicios con 'docker compose up -d'."
echo "3. Importar el SQL con: 'cat db_XXX.sql | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME'"
