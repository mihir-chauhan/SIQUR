"""
Web app — runs on 0.0.0.0:8000, safe to restart anytime.

Serves the frontend and proxies WebSocket frames bidirectionally
between the browser and the model worker (localhost:8001).
No ML code here — the model lives entirely in worker.py.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import websockets
import websockets.exceptions
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse

FRONTEND    = Path(__file__).parent.parent / "frontend" / "index.html"
OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"
WORKER_HTTP = "http://127.0.0.1:8001"
WORKER_WS   = "ws://127.0.0.1:8001/generate"

app = FastAPI(title="VideoGen App")


# ── Frontend ────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return FileResponse(FRONTEND)


# ── Serve generated videos ───────────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles
OUTPUTS_DIR.mkdir(exist_ok=True)
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")


# ── Worker health pass-through (used by frontend to show status) ─────────────
@app.get("/worker/health")
async def worker_health():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{WORKER_HTTP}/health")
            return r.json()
    except Exception:
        return JSONResponse({"status": "offline"}, status_code=503)


# ── WebSocket proxy ──────────────────────────────────────────────────────────
@app.websocket("/ws")
async def ws_proxy(browser: WebSocket):
    await browser.accept()

    try:
        worker = await websockets.connect(
            WORKER_WS,
            max_size=None,          # no message size limit (video chunks)
            open_timeout=5,
            close_timeout=5,
        )
    except (OSError, websockets.exceptions.WebSocketException):
        await browser.send_json({
            "type": "error",
            "message": "Model worker is offline. Start it with ./start_worker.sh",
        })
        return

    # ── browser → worker ────────────────────────────────────────────────
    async def b2w():
        try:
            while True:
                msg = await browser.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                text  = msg.get("text")
                bdata = msg.get("bytes")
                if text:
                    await worker.send(text)
                elif bdata:
                    await worker.send(bdata)
        except (WebSocketDisconnect, Exception):
            pass
        finally:
            await worker.close()

    # ── worker → browser ────────────────────────────────────────────────
    async def w2b():
        try:
            async for msg in worker:
                if isinstance(msg, bytes):
                    await browser.send_bytes(msg)
                else:
                    await browser.send_text(msg)
        except (websockets.exceptions.ConnectionClosed, Exception):
            pass

    b2w_task = asyncio.create_task(b2w())
    w2b_task = asyncio.create_task(w2b())

    # Stop both directions as soon as either side closes
    done, pending = await asyncio.wait(
        [b2w_task, w2b_task],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for t in pending:
        t.cancel()
