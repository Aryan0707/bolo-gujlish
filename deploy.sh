#!/usr/bin/env bash
# Rebuilds the standalone bundle and syncs every place that embeds a
# copy of it. docs/index.html is what GitHub Pages actually serves;
# gujlish-mobile's FlashReply.html is a native app bundling a frozen
# snapshot at build time, not a live fetch — it silently goes stale
# unless this copy runs every time the web app changes. Deliberately
# stops short of git add/commit/push — review the diff and push
# yourself (or ask Claude to), same as ever.
set -euo pipefail
cd "$(dirname "$0")"

MOBILE_HTML="/Users/aryan/Documents/claude/gujlish-mobile/GujlishMobile/FlashReply.html"

echo "==> Building dist/gujlish.html + dist/artifact-fragment.html"
python3 build.py

echo "==> Syncing docs/index.html (GitHub Pages)"
cp dist/gujlish.html docs/index.html

if [ -d "$(dirname "$MOBILE_HTML")" ]; then
  echo "==> Syncing gujlish-mobile's bundled copy"
  cp dist/gujlish.html "$MOBILE_HTML"
else
  echo "==> Skipping gujlish-mobile sync — project not found at $MOBILE_HTML"
fi

echo "==> Done. Review with 'git status' / 'git diff', then commit and push."
