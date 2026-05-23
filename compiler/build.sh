#!/bin/bash
set -e

mkdir -p ./web_build

declare -a SRC_FILES

while CBRANCH= read -r -d $'\0' file; do
    SRC_FILES+=("$file")
done < <(find . -maxdepth 3 -name '*.c' -print0)

if [ ${#SRC_FILES[@]} -eq 0 ]; then
    echo "Erreur fatale : Aucun fichier .c trouvé dans le projet !"
    exit 1
fi

INCLUDE_FLAGS=("-I.")
[ -d "include" ] && INCLUDE_FLAGS+=("-Iinclude")
[ -d "lib" ] && INCLUDE_FLAGS+=("-Ilib")

ASSETS_FLAG=""
if [ -d "assets" ]; then
    ASSETS_FLAG="--preload-file assets"
    echo "-> Dossier 'assets/' détecté et empaqueté."
fi

echo "-> Compilation Emscripten en cours..."
emcc "${SRC_FILES[@]}" \
    -o ./web_build/index.html \
    -Os \
    -Wall \
    "${INCLUDE_FLAGS[@]}" \
    -I/opt/raylib/src \
    -L/opt/raylib/src \
    -lraylib \
    -s USE_GLFW=3 \
    -s ASYNCIFY \
    -s ALLOW_MEMORY_GROWTH=1 \
    -DPLATFORM_WEB \
    $ASSETS_FLAG

echo "=== Compilation terminée avec succès ! ==="