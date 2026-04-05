#!/usr/bin/env bash
# ── CCTV Synthetic Dataset Generator ────────────────────────────────────────
# Runs on port 8002 by default (set PORT= to override).
# Reuses the same Python venv as the VideoGen app.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/../video-gen/.venv"

if [ ! -f "$VENV/bin/activate" ]; then
  echo "ERROR: venv not found at $VENV"
  echo "  Run the VideoGen setup first (the venv is shared)."
  exit 1
fi

source "$VENV/bin/activate"
cd "$SCRIPT_DIR/backend"

PORT="${PORT:-8002}"
MODEL_ID="${MODEL_ID:-Wan-AI/Wan2.2-I2V-A14B-Diffusers}"

echo ""
echo "  CCTV Synthetic Dataset Generator"
echo "  Model  : $MODEL_ID"
echo "  App    : http://localhost:$PORT"
echo "  Ctrl-C : stop"
echo ""

exec env MODEL_ID="$MODEL_ID" \
  "$VENV/bin/python3" -m uvicorn app:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --log-level info \
  --reload \
  --reload-dir . \
  --timeout-keep-alive 600 \
  --ws-ping-interval 20 \
  --ws-ping-timeout 60
