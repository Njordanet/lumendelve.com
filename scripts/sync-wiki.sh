#!/usr/bin/env bash
set -euo pipefail

LUMENDELVE_DIR="/Users/njorda/Developer/Lumendelve"
DATA_DEST_DIR="/Users/njorda/Developer/lumendelve.com/wiki/data"
ICON_SRC_DIR="${LUMENDELVE_DIR}/apps/godot/assets/ui/icons/"
ICON_DEST_DIR="/Users/njorda/Developer/lumendelve.com/wiki/assets/icons/"

mkdir -p "$DATA_DEST_DIR" "$ICON_DEST_DIR"

(
  cd "$LUMENDELVE_DIR"
  pnpm exec tsx scripts/wiki/export-web.ts --out "$DATA_DEST_DIR"
)

rsync -av --delete --include='skill_*.jpg' --exclude='*' "$ICON_SRC_DIR" "$ICON_DEST_DIR"
