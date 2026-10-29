#!/usr/bin/env bash
# Type-checks every Edge Function with Deno (installed as an npm dev dependency).
set -euo pipefail
cd "$(dirname "$0")/.."
for f in supabase/functions/*/index.ts; do case "$f" in */_shared/*) continue;; esac; npx deno check "$f"; done
