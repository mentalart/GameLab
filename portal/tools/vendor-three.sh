#!/usr/bin/env bash
# Кладёт three.js одной закреплённой версии в portal/engine/vendor/three/ (только нужные файлы).
# Запуск из корня репозитория: bash portal/tools/vendor-three.sh [версия]
# CDN из среды Claude закрыт, а tarball из registry.npmjs.org скачивается — поэтому берём его.
set -euo pipefail
VER="${1:-0.170.0}"
DEST="portal/engine/vendor/three"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -sSfL -o "$TMP/three.tgz" "https://registry.npmjs.org/three/-/three-$VER.tgz"
tar xzf "$TMP/three.tgz" -C "$TMP"
SRC="$TMP/package"
rm -rf "$DEST"; mkdir -p "$DEST/addons"
cp "$SRC/build/three.module.min.js" "$SRC/LICENSE" "$DEST/"
# дополнения: постобработка (свечение), слияние геометрии, модели glTF, окружение для бликов, скруглённые коробки, шум
ADDONS="postprocessing/EffectComposer.js postprocessing/RenderPass.js postprocessing/UnrealBloomPass.js
postprocessing/OutputPass.js postprocessing/ShaderPass.js postprocessing/MaskPass.js postprocessing/Pass.js
shaders/CopyShader.js shaders/LuminosityHighPassShader.js shaders/OutputShader.js
utils/BufferGeometryUtils.js utils/SkeletonUtils.js loaders/GLTFLoader.js
environments/RoomEnvironment.js geometries/RoundedBoxGeometry.js math/SimplexNoise.js"
for f in $ADDONS; do mkdir -p "$DEST/addons/$(dirname "$f")"; cp "$SRC/examples/jsm/$f" "$DEST/addons/$f"; done
SHA="$(sha1sum "$TMP/three.tgz" | cut -d' ' -f1)"
printf 'three %s\nИсточник: https://registry.npmjs.org/three/-/three-%s.tgz (sha1 %s)\nСкачано %s скриптом portal/tools/vendor-three.sh\n' "$VER" "$VER" "$SHA" "$(date +%F)" > "$DEST/VERSION.txt"
(cd "$DEST" && find . -type f | sort | xargs wc -c) 
