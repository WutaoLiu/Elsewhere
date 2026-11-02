#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then
  echo '请先检查并提交本地改动，再发布。' >&2
  exit 1
fi
git push origin main
git subtree push --prefix=site origin gh-pages
