"""
Video generation backend — FastAPI + WebSocket.

Protocol (all JSON unless noted):
  Client → Server:
    { prompt, image?, model_id?, num_frames?, steps?, guidance_scale?,
      width?, height?, fps?, seed?, preview_every? }

  Server → Client (JSON):
    { type: "status",        message: str }
    { type: "progress",      step: int, total: int, preview?: dataURL }
    { type: "video_start",   fps: int, frames: int, width: int, height: int }
    { type: "done" }
    { type: "error",         message: str }

  Server → Client (binary):
    raw fMP4 chunks (after "video_start", before "done")
"""

from __future__ import annotations

import asyncio
import base64
import concurrent.futures
import io
import subprocess
import time
from pathlib import Path
from typing import Optional

import imageio_ffmpeg
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from PIL import Image

FRONTEND = Path(__file__).parent.parent / "frontend" / "index.html"

# Use imageio-ffmpeg's bundled binary so we don't depend on system ffmpeg
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

app = FastAPI(title="VideoGen")

# Serve the frontend SPA
@app.get("/")
async def root():
    return FileResponse(FRONTEND)

# One-at-a-time generation (single GPU)
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="gen")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_image(data_url: str) -> Image.Image:
    raw = base64.b64decode(data_url.split(",")[-1])
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _frames_to_fmp4(frames: list[Image.Image], fps: int) -> bytes:
    """Encode PIL frames → in-memory fragmented MP4 (H.264 baseline)."""
    if not frames:
        return b""

    w, h = frames[0].size

    proc = subprocess.Popen(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "rawvideo", "-vcodec", "rawvideo",
            "-s", f"{w}x{h}", "-pix_fmt", "rgb24", "-r", str(fps),
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-profile:v", "baseline",
            "-level", "3.1",
            "-pix_fmt", "yuv420p",
            # Fragmented MP4 flags for MediaSource streaming
            "-movflags", "frag_keyframe+empty_moov+default_base_moof+faststart",
            "-f", "mp4",
            "pipe:1",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    for frame in frames:
        proc.stdin.write(np.array(frame).tobytes())
    proc.stdin.close()

    video_bytes = proc.stdout.read()
    proc.wait()
    return video_bytes


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
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

    try:
        req = await ws.receive_json()
    except WebSocketDisconnect:
        return

    # ------------------------------------------------------------------ #
    # Parse request                                                        #
    # ------------------------------------------------------------------ #
    prompt        = req.get("prompt", "").strip()
    image_data    = req.get("image")               # base64 data URL or None
    model_id      = req.get("model_id", "Wan-AI/Wan2.2-I2V-A14B-Diffusers")
    num_frames    = int(req.get("num_frames",   81))
    steps         = int(req.get("steps",        20))
    guidance      = float(req.get("guidance_scale", 5.0))
    fps           = int(req.get("fps",          16))
    width         = int(req.get("width",       832))
    height        = int(req.get("height",      480))
    seed          = int(req.get("seed",         -1))   # -1 = random
    preview_every = int(req.get("preview_every",  4))

    if not prompt:
        await send({"type": "error", "message": "prompt is required"})
        return

    # Decode reference image
    image: Optional[Image.Image] = None
    if image_data:
        try:
            image = _decode_image(image_data)
        except Exception as exc:
            await send({"type": "error", "message": f"image decode failed: {exc}"})
            return

    # ------------------------------------------------------------------ #
    # Progress callback (called from executor thread via asyncio bridge)  #
    # ------------------------------------------------------------------ #
    async def on_progress(step: int, total: int, preview: Optional[Image.Image]):
        msg: dict = {"type": "progress", "step": step, "total": total}
        if preview is not None:
            buf = io.BytesIO()
            preview.save(buf, format="JPEG", quality=72)
            msg["preview"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        await send(msg)

    # ------------------------------------------------------------------ #
    # Run generation in thread pool                                        #
    # ------------------------------------------------------------------ #
    await send({"type": "status", "message": "Loading model…"})

    from pipeline import run_generation

    try:
        t0 = time.time()
        frames: list[Image.Image] = await loop.run_in_executor(
            _executor,
            run_generation,
            prompt, image, num_frames, steps, guidance,
            model_id, preview_every, on_progress, loop,
            width, height, seed,
        )
        gen_time = time.time() - t0
        print(f"[main] generated {len(frames)} frames in {gen_time:.1f}s")
    except Exception as exc:
        import traceback
        traceback.print_exc()
        await send({"type": "error", "message": str(exc)})
        return

    # ------------------------------------------------------------------ #
    # Encode to fMP4 and stream binary chunks                              #
    # ------------------------------------------------------------------ #
    await send({"type": "status", "message": "Encoding video…"})

    w, h = frames[0].size

    try:
        proc = subprocess.Popen(
            [
                FFMPEG, "-y", "-loglevel", "error",
                "-f", "rawvideo", "-vcodec", "rawvideo",
                "-s", f"{w}x{h}", "-pix_fmt", "rgb24", "-r", str(fps),
                "-i", "pipe:0",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-profile:v", "baseline",
                "-level", "3.1",
                "-pix_fmt", "yuv420p",
                "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                "-f", "mp4",
                "pipe:1",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Write frames to ffmpeg stdin in a background thread so we can
        # simultaneously drain stdout — avoids pipe deadlock on large videos.
        import threading

        def _write_frames():
            try:
                for f in frames:
                    proc.stdin.write(np.array(f).tobytes())
            finally:
                proc.stdin.close()

        write_thread = threading.Thread(target=_write_frames, daemon=True)
        write_thread.start()

        # Signal frontend to prepare MediaSource player
        await send({
            "type":   "video_start",
            "fps":    fps,
            "frames": len(frames),
            "width":  w,
            "height": h,
        })

        # Stream fMP4 chunks as they emerge from ffmpeg stdout
        CHUNK = 32 * 1024   # 32 KB
        while True:
            chunk = await loop.run_in_executor(None, proc.stdout.read, CHUNK)
            if not chunk:
                break
            await send_bytes(chunk)

        write_thread.join()
        proc.wait()

    except Exception as exc:
        import traceback
        traceback.print_exc()
        await send({"type": "error", "message": f"encode failed: {exc}"})
        return

    await send({"type": "done"})
