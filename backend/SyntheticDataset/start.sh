#!/usr/bin/env bash
# ── Start both worker and app in one terminal ───────────────────────────────
# For production / separate terminals use start_worker.sh + start_app.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/video-gen/.venv/bin/activate"
cd "$SCRIPT_DIR/backend"

MODEL_ID="${MODEL_ID:-Wan-AI/Wan2.2-I2V-A14B-Diffusers}"
WORKER_PORT="${WORKER_PORT:-8001}"
APP_PORT="${PORT:-8000}"

echo ""
echo "  VideoGen"
echo "  Model  : $MODEL_ID"
echo "  App    : http://localhost:$APP_PORT"
echo ""

cleanup() {
  echo ""
  echo "[start] shutting down…"
  kill "$WORKER_PID" 2>/dev/null || true
  wait "$WORKER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start worker in background
env MODEL_ID="$MODEL_ID" "$SCRIPT_DIR/video-gen/.venv/bin/python3" -m uvicorn worker:app \
  --host 127.0.0.1 --port "$WORKER_PORT" \
  --log-level info --timeout-keep-alive 600 \
  --ws-ping-interval 20 --ws-ping-timeout 60 &
WORKER_PID=$!

# Give worker a moment to bind before app starts
sleep 1

# Start app in foreground (--reload lets you edit frontend/app.py without restart)
exec "$SCRIPT_DIR/video-gen/.venv/bin/python3" -m uvicorn app:app \
  --host 0.0.0.0 --port "$APP_PORT" \
  --log-level info \
  --reload --reload-dir . \
  --timeout-keep-alive 300
