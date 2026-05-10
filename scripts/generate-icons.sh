#!/usr/bin/env bash
# Genera los iconos a partir de public/YAJA-source.png (o .svg)
# Requiere ImageMagick (`convert`) y `png2ico` opcionalmente.
# Uso:
# 1) Coloca tu imagen fuente en public/YAJA-source.png (recomendado PNG/PNG transparente) o YAJA-source.svg
# 2) ./scripts/generate-icons.sh

set -euo pipefail
SRC="public/YAJA-source.png"
if [ ! -f "$SRC" ]; then
  if [ -f "public/YAJA-source.svg" ]; then
    echo "Usando SVG de fuente public/YAJA-source.svg"
    SRC="public/YAJA-source.svg"
  else
    echo "ERROR: coloca la imagen fuente en public/YAJA-source.png o public/YAJA-source.svg"
    exit 1
  fi
fi

OUT_DIR="public"
mkdir -p "$OUT_DIR"

echo "Generando android-chrome-512x512.png"
convert "$SRC" -resize 512x512^ -gravity center -extent 512x512 "$OUT_DIR/android-chrome-512x512.png"

echo "Generando android-chrome-192x192.png"
convert "$SRC" -resize 192x192^ -gravity center -extent 192x192 "$OUT_DIR/android-chrome-192x192.png"

echo "Generando apple-touch-icon.png (180x180)"
convert "$SRC" -resize 180x180^ -gravity center -extent 180x180 "$OUT_DIR/apple-touch-icon.png"

# favicon.ico a partir de 32x32
echo "Generando favicon-32.png"
convert "$SRC" -resize 32x32^ -gravity center -extent 32x32 "$OUT_DIR/favicon-32.png"

if command -v png2ico >/dev/null 2>&1; then
  echo "Generando favicon.ico con png2ico"
  png2ico "$OUT_DIR/favicon.ico" "$OUT_DIR/favicon-32.png"
else
  echo "png2ico no disponible: generando favicon.ico con ImageMagick (soporta multiples tamaños)"
  convert "$OUT_DIR/favicon-32.png" "$OUT_DIR/android-chrome-192x192.png" -define icon:auto-resize=64,48,32,16 "$OUT_DIR/favicon.ico"
fi

# Optimiza copia principal
echo "Generando YAJA-logo-512.png"
convert "$SRC" -resize 512x512^ -gravity center -extent 512x512 -strip -interlace Plane -quality 85 "$OUT_DIR/YAJA-logo-512.png"

echo "Hecho. Archivos generados en public/:"
ls -la "$OUT_DIR" | egrep "android-chrome|apple-touch-icon|favicon|YAJA-logo"

# Añadir al git
if command -v git >/dev/null 2>&1; then
  git add "$OUT_DIR/android-chrome-512x512.png" "$OUT_DIR/android-chrome-192x192.png" "$OUT_DIR/apple-touch-icon.png" "$OUT_DIR/favicon.ico" "$OUT_DIR/YAJA-logo-512.png" || true
  echo "Archivos añadidos al staging. Commit con: git commit -m 'chore: add YAJA icons'"
fi
