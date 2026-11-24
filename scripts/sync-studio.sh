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
const cacheBust = process.env.CACHE_BUST || '20261124';
let html = fs.readFileSync(indexPath, 'utf8');
let changed = false;

const headCloseMatch = html.match(/^([ \t]*)<\/head>/m);
if (!headCloseMatch) {
  console.error(`Error: No </head> tag found in ${indexPath}`);
  process.exit(1);
}
const headIndent = `${headCloseMatch[1] || ''}  `;

const headMetas = [
  {
    pattern: /<meta\s+name=["']robots["']/i,
    tag: `<meta name="robots" content="noindex, nofollow" />`,
    label: 'robots meta tag',
  },
  {
    pattern: /<meta\s+http-equiv=["']Cache-Control["']/i,
    tag: `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />`,
    label: 'Cache-Control meta tag',
  },
  {
    pattern: /<meta\s+http-equiv=["']Pragma["']/i,
    tag: `<meta http-equiv="Pragma" content="no-cache" />`,
    label: 'Pragma meta tag',
  },
  {
    pattern: /<meta\s+http-equiv=["']Expires["']/i,
    tag: `<meta http-equiv="Expires" content="0" />`,
    label: 'Expires meta tag',
  },
];

const missingMetas = headMetas.filter((meta) => !meta.pattern.test(html));
if (missingMetas.length > 0) {
  const injection = missingMetas.map((meta) => `${headIndent}${meta.tag}\n`).join('');
  html = html.replace(headCloseMatch[0], `${injection}${headCloseMatch[0]}`);
  changed = true;
  console.log(`Injected ${missingMetas.map((m) => m.label).join(', ')} into ${indexPath}`);
} else {
  console.log(`robots and no-cache meta tags already present in ${indexPath}`);
}

const stylesPattern = /href=(["'])\.\/styles\.css(?:\?v=[^"']*)?\1/;
if (stylesPattern.test(html)) {
  const updatedStyles = html.replace(stylesPattern, `href=$1./styles.css?v=${cacheBust}$1`);
  if (updatedStyles !== html) {
    html = updatedStyles;
    changed = true;
    console.log(`Updated ./styles.css cache-bust query in ${indexPath}`);
  }
}

const bridgePattern = /src=(["'])\.\/studio-bridge\.js(?:\?v=[^"']*)?\1/;
if (!bridgePattern.test(html)) {
  const match = html.match(/^([ \t]*)<script\s+/m);
  if (!match) {
    console.error(`Error: No <script > tag found in ${indexPath}`);
    process.exit(1);
  }
  const indent = match[1] || '';
  const injection = `${indent}<script src="./studio-bridge.js?v=${cacheBust}"></script>\n${match[0]}`;
  html = html.replace(match[0], injection);
  changed = true;
  console.log(`Injected <script src="./studio-bridge.js?v=${cacheBust}"></script> into ${indexPath}`);
} else {
  const updatedBridge = html.replace(bridgePattern, `src=$1./studio-bridge.js?v=${cacheBust}$1`);
  if (updatedBridge !== html) {
    html = updatedBridge;
    changed = true;
    console.log(`Updated ./studio-bridge.js cache-bust query in ${indexPath}`);
  } else {
    console.log(`studio-bridge.js?v=${cacheBust} already present in ${indexPath}`);
  }
}

if (changed) {
  fs.writeFileSync(indexPath, html, 'utf8');
}
NODE
