#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$SCRIPT_DIR/backend"
VENV="$SCRIPT_DIR/.venv"

# ── Python environment ────────────────────────────────────────
if [[ ! -d "$VENV" ]]; then
  echo "[start] Creating virtual environment…"
  python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"

echo "[start] Installing / verifying dependencies…"
pip install -q --upgrade pip
pip install -q -r "$BACKEND/requirements.txt"

# ── Launch server ─────────────────────────────────────────────
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo ""
echo "  VideoGen server starting"
echo "  Local:   http://localhost:$PORT"
echo "  Network: http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""

cd "$BACKEND"
exec uvicorn main:app \
  --host "$HOST" \
  --port "$PORT" \
  --log-level info \
  --timeout-keep-alive 300 \
  --ws-max-size 104857600
