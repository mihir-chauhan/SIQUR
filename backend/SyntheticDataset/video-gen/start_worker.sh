#!/usr/bin/env bash
# ── Model worker — run this ONCE and leave it running ──────────────────────
# The model loads at startup and stays hot in memory.
# Restart only when you want to switch the preloaded model.
#
# Override the preloaded model:
#   MODEL_ID=Wan-AI/Wan2.1-I2V-14B-480P-Diffusers ./start_worker.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.venv/bin/activate"
cd "$SCRIPT_DIR/backend"

MODEL_ID="${MODEL_ID:-Wan-AI/Wan2.2-I2V-A14B-Diffusers}"
PORT="${WORKER_PORT:-8001}"

echo ""
echo "  VideoGen model worker"
echo "  Model : $MODEL_ID"
echo "  Port  : localhost:$PORT  (internal only)"
echo ""

exec env MODEL_ID="$MODEL_ID" uvicorn worker:app \
  --host 127.0.0.1 \
  --port "$PORT" \
  --log-level info \
  --timeout-keep-alive 600 \
  --ws-ping-interval 20 \
  --ws-ping-timeout 60
