#!/usr/bin/env bash
# Rebuild viewer/ from the Lichtblick web release (source maps dropped, default layout injected).
set -euo pipefail
VERSION="${1:-v1.30.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d "${RISELAB_SCRATCH:-/tmp}/lichtblick.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
curl -fsSL -o "$WORK/web.tgz" "https://github.com/lichtblick-suite/lichtblick/releases/download/$VERSION/lichtblick-web.tar.gz"
mkdir "$WORK/x" && tar xzf "$WORK/web.tgz" -C "$WORK/x"
rm -rf "$ROOT/viewer" && mkdir "$ROOT/viewer"
(cd "$WORK/x" && find . -type f ! -name '*.map' -exec cp --parents {} "$ROOT/viewer/" \;)
python3 - "$ROOT/viewer/index.html" "$ROOT/scripts/viewer-layout.json" <<'PY'
import json, sys
page, layout = sys.argv[1], json.load(open(sys.argv[2]))
s = open(page).read()
marker = '/*LICHTBLICK_SUITE_DEFAULT_LAYOUT_PLACEHOLDER*/'
assert marker in s
open(page, 'w').write(s.replace(marker, json.dumps(layout, separators=(',', ':'))))
PY
echo "viewer/ <- lichtblick $VERSION ($(du -sh "$ROOT/viewer" | cut -f1))"
