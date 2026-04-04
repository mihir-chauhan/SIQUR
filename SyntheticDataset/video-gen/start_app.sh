#!/usr/bin/env bash
# ── Web app — safe to restart anytime without touching the model ────────────
# No ML code here. Just serves the frontend and proxies to the worker.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.venv/bin/activate"
cd "$SCRIPT_DIR/backend"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo ""
echo "  VideoGen web app"
echo "  Local  : http://localhost:$PORT"
echo "  Network: http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""

exec uvicorn app:app \
  --host "$HOST" \
  --port "$PORT" \
  --log-level info \
  --reload \
  --reload-dir . \
  --timeout-keep-alive 300
