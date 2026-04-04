"""
Model worker — runs on localhost:8001, never restarted.

Loads the pipeline once at startup and keeps it hot.
Accepts WebSocket connections from app.py and streams
generation progress + fMP4 video chunks back.

Set MODEL_ID env var to control which model is preloaded:
    MODEL_ID=Wan-AI/Wan2.1-I2V-14B-480P-Diffusers python -m uvicorn worker:app ...
"""

from __future__ import annotations

import asyncio
import base64
import concurrent.futures
import io
import os
import subprocess
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import imageio_ffmpeg
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from PIL import Image

from pipeline import load_pipeline, run_generation

# ---------------------------------------------------------------------------
DEFAULT_MODEL = os.environ.get("MODEL_ID", "Wan-AI/Wan2.2-I2V-A14B-Diffusers")
FFMPEG        = imageio_ffmpeg.get_ffmpeg_exe()
OUTPUTS_DIR   = Path(__file__).parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="gen")
_gen_lock: asyncio.Semaphore | None = None   # created in lifespan


# ---------------------------------------------------------------------------
# Startup: preload model so first request is instant
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _gen_lock
    _gen_lock = asyncio.Semaphore(1)

    loop = asyncio.get_event_loop()
    print(f"[worker] preloading {DEFAULT_MODEL} …")
    try:
        await loop.run_in_executor(_executor, load_pipeline, DEFAULT_MODEL)
        print("[worker] model hot — ready for requests")
    except Exception as exc:
        print(f"[worker] preload error (will retry on first request): {exc}")
    yield


app = FastAPI(title="VideoGen Worker", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Health endpoint — app.py polls this
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    busy = _gen_lock is not None and _gen_lock.locked()
    return {"status": "busy" if busy else "ready", "model": DEFAULT_MODEL}


# ---------------------------------------------------------------------------
# Generation WebSocket
# ---------------------------------------------------------------------------

def _decode_image(data_url: str) -> Image.Image:
    raw = base64.b64decode(data_url.split(",")[-1])
    return Image.open(io.BytesIO(raw)).convert("RGB")


@app.websocket("/generate")
async def generate(ws: WebSocket):
    await ws.accept()
    loop = asyncio.get_event_loop()

    async def send(obj: dict):
        try:
            await ws.send_json(obj)
        except Exception:
            pass

    async def send_bytes(data: bytes):
        try:
            await ws.send_bytes(data)
        except Exception:
            pass

    if _gen_lock is not None and _gen_lock.locked():
        await send({"type": "error", "message": "Worker busy — another generation is in progress"})
        return

    try:
        req = await ws.receive_json()
    except WebSocketDisconnect:
        return

    # ── Parse request ────────────────────────────────────────────────── #
    prompt        = req.get("prompt", "").strip()
    image_data    = req.get("image")
    model_id      = req.get("model_id", DEFAULT_MODEL)
    num_frames    = int(req.get("num_frames",    17))
    steps         = int(req.get("steps",         20))
    guidance      = float(req.get("guidance_scale", 5.0))
    fps           = int(req.get("fps",           16))
    width         = int(req.get("width",        832))
    height        = int(req.get("height",       480))
    seed          = int(req.get("seed",          -1))
    preview_every = int(req.get("preview_every",  4))

    if not prompt:
        await send({"type": "error", "message": "prompt is required"})
        return

    image: Optional[Image.Image] = None
    if image_data:
        try:
            image = _decode_image(image_data)
        except Exception as exc:
            await send({"type": "error", "message": f"image decode failed: {exc}"})
            return

    # ── Progress callback ────────────────────────────────────────────── #
    async def on_progress(step: int, total: int, preview: Optional[Image.Image]):
        msg: dict = {"type": "progress", "step": step, "total": total}
        if preview is not None:
            buf = io.BytesIO()
            preview.save(buf, format="JPEG", quality=72)
            msg["preview"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        await send(msg)

    # ── Generate ─────────────────────────────────────────────────────── #
    async with _gen_lock:
        await send({"type": "status", "message": "Generating…"})

        # Keepalive: browser WebSockets drop after ~60s of silence.
        # Send a ping every 20s so the connection stays alive during long runs.
        keepalive_active = True
        async def _keepalive():
            while keepalive_active:
                await asyncio.sleep(20)
                if keepalive_active:
                    await send({"type": "ping"})

        ka_task = asyncio.create_task(_keepalive())

        t0 = time.time()
        try:
            frames: list[Image.Image] = await loop.run_in_executor(
                _executor,
                run_generation,
                prompt, image, num_frames, steps, guidance,
                model_id, preview_every, on_progress, loop,
                width, height, seed,
            )
        except Exception as exc:
            keepalive_active = False
            ka_task.cancel()
            import traceback; traceback.print_exc()
            await send({"type": "error", "message": str(exc)})
            return
        finally:
            keepalive_active = False
            ka_task.cancel()

        print(f"[worker] {len(frames)} frames in {time.time() - t0:.1f}s")

        # ── Encode → MP4 file ───────────────────────────────────────────── #
        await send({"type": "status", "message": "Encoding video…"})
        w, h = frames[0].size

        ts       = int(time.time())
        filename = f"output_{ts}.mp4"
        out_path = OUTPUTS_DIR / filename

        # Build raw pixel data once; ~90 MB for 81 frames at 480P — fine in RAM.
        # Run subprocess.run() entirely inside an executor so the event loop is
        # never blocked. communicate() drains stderr to avoid pipe deadlocks.
        def _encode() -> tuple[int, str]:
            raw = b"".join(np.array(f).tobytes() for f in frames)
            result = subprocess.run(
                [
                    FFMPEG, "-y", "-loglevel", "info",
                    "-f", "rawvideo", "-vcodec", "rawvideo",
                    "-s", f"{w}x{h}", "-pix_fmt", "rgb24", "-r", str(fps),
                    "-i", "pipe:0",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    str(out_path),
                ],
                input=raw,
                capture_output=True,
            )
            return result.returncode, result.stderr.decode(errors="replace")

        try:
            rc, ffmpeg_log = await loop.run_in_executor(None, _encode)
        except Exception as exc:
            import traceback; traceback.print_exc()
            await send({"type": "error", "message": f"encode failed: {exc}"})
            return

        # Always print ffmpeg output so failures are visible in worker logs.
        if ffmpeg_log:
            print(f"[worker] ffmpeg output:\n{ffmpeg_log[-1000:]}")

        if rc != 0:
            await send({"type": "error", "message": f"ffmpeg exited {rc} — check worker logs"})
            return

        if not out_path.exists():
            await send({"type": "error", "message": "ffmpeg exited 0 but output file missing"})
            return

        print(f"[worker] saved {out_path}  ({out_path.stat().st_size:,} bytes)")

    await send({"type": "done", "url": f"/outputs/{filename}",
                "frames": len(frames), "fps": fps})
