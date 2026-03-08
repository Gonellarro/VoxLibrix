#!/bin/bash

# Comprobar si se ha pasado un archivo como argumento
if [ -z "$1" ]; then
    echo "Uso: $0 nombre_del_archivo.txt"
    exit 1
fi

FICHERO=$1
NOMBRE_BASE="${FICHERO%.*}"
EXTENSION="${FICHERO##*.}"

# Variables de control
CONTADOR_PALABRAS=0
PARTE=1
BUFFER=""

# Leemos el archivo palabra por palabra
for PALABRA in $(cat "$FICHERO"); do
    BUFFER="$BUFFER $PALABRA"
    ((CONTADOR_PALABRAS++))

    # Si hemos pasado las 1200 palabras y la palabra actual contiene un punto
    if [ $CONTADOR_PALABRAS -ge 1200 ] && [[ "$PALABRA" == *"."* ]]; then
        # Guardar el contenido en el nuevo fichero
        echo $BUFFER > "${NOMBRE_BASE}_parte${PARTE}.${EXTENSION}"
        
        # Resetear para la siguiente parte
        echo "Creado: ${NOMBRE_BASE}_parte${PARTE}.${EXTENSION} con $CONTADOR_PALABRAS palabras."
        BUFFER=""
        CONTADOR_PALABRAS=0
        ((PARTE++))
    fi
done

# Si al final queda algo en el buffer, se guarda en el último fichero
if [ -n "$BUFFER" ]; then
    echo $BUFFER > "${NOMBRE_BASE}_parte${PARTE}.${EXTENSION}"
    echo "Creado: ${NOMBRE_BASE}_parte${PARTE}.${EXTENSION} (última parte)."
fi