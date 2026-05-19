#!/bin/sh
set -e

echo "=== Début de la compilation Web (Standard Promo) ==="

# 1. Création d'un dossier de sortie propre (isole le web du build Linux)
mkdir -p web_build

# 2. Récupération dynamique des fichiers sources
# On prend tous les .c à la racine (ex: main.c) ET tous les .c dans le dossier src/
SRC_FILES=$(find . -maxdepth 1 -name '*.c')
if [ -d "src" ]; then
    SRC_FILES="$SRC_FILES $(find src -name '*.c')"
fi

# Ajout dynamique des fichiers sources du dossier lib/ s'il existe
if [ -d "lib" ]; then
    SRC_FILES="$SRC_FILES $(find lib -name '*.c')"
    echo "-> Dossier 'lib/' détecté : sources ajoutées."
fi

# Sécurité : vérifier qu'on a bien trouvé du code C
if [ -z "$(echo "$SRC_FILES" | tr -d '[:space:]')" ]; then
    echo "Erreur fatale : Aucun fichier .c trouvé à la racine, dans src/ ou dans lib/ !"
    exit 1
fi

# 3. Inclusion automatique des dossiers de headers
INCLUDE_FLAGS="-I."
if [ -d "include" ]; then
    INCLUDE_FLAGS="$INCLUDE_FLAGS -Iinclude"
fi

# Ajout de lib/ pour la recherche des headers (#include)
if [ -d "lib" ]; then
    INCLUDE_FLAGS="$INCLUDE_FLAGS -Ilib"
fi

# 4. Empaquetage automatique des ressources
ASSETS_FLAG=""
if [ -d "assets" ]; then
    ASSETS_FLAG="--preload-file assets"
    echo "-> Dossier 'assets/' détecté et empaqueté."
fi

# 5. Lancement de la compilation WebAssembly avec Emscripten
echo "-> Compilation en cours..."
emcc $SRC_FILES \
    -o web_build/index.html \
    -Os \
    -Wall \
    $INCLUDE_FLAGS \
    -I/opt/raylib/src \
    -L/opt/raylib/src \
    -lraylib \
    -s USE_GLFW=3 \
    -s ASYNCIFY \
    -s ALLOW_MEMORY_GROWTH=1 \
    -DPLATFORM_WEB \
    $ASSETS_FLAG

# 6. Vérification du résultat
if [ $? -eq 0 ]; then
    echo "=== Compilation terminée avec succès ! ==="
    echo "Les fichiers sont prêts dans le dossier : ./web_build/"
    echo "Pour tester le jeu, lancez :"
    echo "cd web_build && python3 -m http.server 8000"
else
    echo "=== Échec de la compilation ! ==="
    echo "Vérifiez les erreurs du compilateur ci-dessus."
    exit 1
fi
