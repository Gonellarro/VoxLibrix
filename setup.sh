#!/bin/bash

# Script de configuración inicial para VoxLibrix
# Crea los directorios necesarios y asigna los permisos correctos
# para que el usuario 1000 (Docker) pueda escribir.

echo "🚀 Configurando entorno para VoxLibrix..."

# Crear carpeta de datos si no existe
if [ ! -d "data" ]; then
    echo "📁 Creando carpeta 'data'..."
    mkdir -p data
fi

# Asignar permisos al usuario 1000 (UID que usan los contenedores)
echo "🔑 Ajustando permisos de la carpeta 'data' (requiere sudo)..."
sudo chown -R 1000:1000 data
sudo chmod -R 775 data

echo "✅ Configuración lista. Ya puedes ejecutar: docker compose --profile cpu up -d"
