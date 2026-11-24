#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="/Users/njorda/Developer/Lumendelve/apps/ld-studio/web/"
DEST_DIR="/Users/njorda/Developer/lumendelve.com/studio/"
INDEX_HTML="${DEST_DIR}index.html"

mkdir -p "$DEST_DIR"

rsync -av --delete --exclude 'studio-bridge.js' "$SRC_DIR" "$DEST_DIR"

if [[ ! -f "$INDEX_HTML" ]]; then
  echo "Error: $INDEX_HTML not found after rsync" >&2
  exit 1
fi

node - "$INDEX_HTML" <<'NODE'
const fs = require('node:fs');

const indexPath = process.argv[2];
let html = fs.readFileSync(indexPath, 'utf8');
let changed = false;

if (!/<meta\s+name=["']robots["']/i.test(html)) {
  const headCloseMatch = html.match(/^([ \t]*)<\/head>/m);
  if (!headCloseMatch) {
    console.error(`Error: No </head> tag found in ${indexPath}`);
    process.exit(1);
  }
  const headIndent = `${headCloseMatch[1] || ''}  `;
  html = html.replace(
    headCloseMatch[0],
    `${headIndent}<meta name="robots" content="noindex, nofollow" />\n${headCloseMatch[0]}`,
  );
  changed = true;
  console.log(`Injected <meta name="robots" content="noindex, nofollow" /> into ${indexPath}`);
} else {
  console.log(`robots meta tag already present in ${indexPath}`);
}

if (!html.includes('./studio-bridge.js')) {
  const match = html.match(/^([ \t]*)<script\s+/m);
  if (!match) {
    console.error(`Error: No <script > tag found in ${indexPath}`);
    process.exit(1);
  }
  const indent = match[1] || '';
  const injection = `${indent}<script src="./studio-bridge.js"></script>\n${match[0]}`;
  html = html.replace(match[0], injection);
  changed = true;
  console.log(`Injected <script src="./studio-bridge.js"></script> into ${indexPath}`);
} else {
  console.log(`studio-bridge.js already present in ${indexPath}`);
}

if (changed) {
  fs.writeFileSync(indexPath, html, 'utf8');
}
NODE
