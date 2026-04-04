#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Activate virtualenv if present
if [[ -f "$SCRIPT_DIR/.venv/bin/activate" ]]; then
    source "$SCRIPT_DIR/.venv/bin/activate"
fi

cd "$SCRIPT_DIR/backend"

QWEN_MODEL_ID="${QWEN_MODEL_ID:-Qwen/Qwen2.5-VL-7B-Instruct}"
PORT="${PORT:-8002}"
POLL_INTERVAL="${WATCHMAN_POLL_INTERVAL:-15}"

echo ""
echo "  ██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗███╗   ███╗ █████╗ ███╗   ██╗"
echo "  ██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║████╗ ████║██╔══██╗████╗  ██║"
echo "  ██║ █╗ ██║███████║   ██║   ██║     ███████║██╔████╔██║███████║██╔██╗ ██║"
echo "  ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║██║╚██╔╝██║██╔══██║██║╚██╗██║"
echo "  ╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║"
echo "   ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝"
echo ""
echo "  AI Security Monitor"
echo "  Model    : $QWEN_MODEL_ID"
echo "  API      : http://localhost:$PORT"
echo "  Poll     : every ${POLL_INTERVAL}s (full cycle across all cameras)"
echo "  WebSocket: ws://localhost:$PORT/ws"
echo ""

exec env \
    QWEN_MODEL_ID="$QWEN_MODEL_ID" \
    WATCHMAN_POLL_INTERVAL="$POLL_INTERVAL" \
    python3 -m uvicorn app:app \
        --host 0.0.0.0 \
        --port "$PORT" \
        --log-level info \
        --timeout-keep-alive 300
