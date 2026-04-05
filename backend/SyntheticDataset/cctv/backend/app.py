"""
CCTV Synthetic Dataset Generator — FastAPI backend (default port 8002)

Serves the floor plan editor UI and orchestrates multi-camera synthetic CCTV
video generation with cross-view actor consistency.

Generation is delegated to the existing VideoGen worker on port 8001 via
WebSocket — no second model load, no extra VRAM.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import shutil
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import websockets
import websockets.exceptions
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel

# ── Paths ─────────────────────────────────────────────────────────────────────

_HERE      = Path(__file__).parent        # cctv/backend/
_CCTV_ROOT = _HERE.parent                 # cctv/
_SD_ROOT   = _CCTV_ROOT.parent            # SyntheticDataset/

sys.path.insert(0, str(_HERE))            # scene_engine.py

FRONTEND      = _CCTV_ROOT / "frontend" / "index.html"
UPLOADS       = _CCTV_ROOT / "uploads"
OUTPUTS       = _CCTV_ROOT / "outputs"
WORKER_OUTPUTS = _SD_ROOT / "outputs"     # where the 8001 worker saves videos

UPLOADS.mkdir(exist_ok=True)
OUTPUTS.mkdir(exist_ok=True)
WORKER_OUTPUTS.mkdir(exist_ok=True)

WORKER_WS   = "ws://127.0.0.1:8001/generate"
WORKER_HTTP = "http://127.0.0.1:8001"

DEFAULT_MODEL = os.environ.get("MODEL_ID", "Wan-AI/Wan2.2-I2V-A14B-Diffusers")

# ── Session store ─────────────────────────────────────────────────────────────

sessions: dict[str, dict] = {}

# ── One job at a time (worker is single-GPU) ─────────────────────────────────

_job_queue: asyncio.Semaphore | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _job_queue
    _job_queue = asyncio.Semaphore(1)
    yield


app = FastAPI(title="CCTV Dataset Generator", lifespan=lifespan)

# Serve cctv-specific uploads + outputs
app.mount("/uploads",        StaticFiles(directory=str(UPLOADS)),        name="uploads")
app.mount("/outputs",        StaticFiles(directory=str(OUTPUTS)),        name="outputs")
# Also serve the worker's output dir so video URLs resolve
app.mount("/worker-outputs", StaticFiles(directory=str(WORKER_OUTPUTS)), name="worker-outputs")


# ── Frontend ──────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return FileResponse(FRONTEND)


@app.get("/worker/health")
async def worker_health():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{WORKER_HTTP}/health")
            return r.json()
    except Exception:
        return {"status": "offline"}


# ── Session ───────────────────────────────────────────────────────────────────

@app.post("/session")
async def create_session():
    sid = str(uuid.uuid4())[:8]
    sessions[sid] = {"floorplan": None, "cameras": [], "scene": None, "jobs": {}}
    return {"session_id": sid}


@app.get("/session/{sid}")
async def get_session(sid: str):
    if sid not in sessions:
        raise HTTPException(404, "Session not found")
    s = sessions[sid]
    return {
        "session_id":    sid,
        "has_floorplan": s["floorplan"] is not None,
        "cameras":       s["cameras"],
        "scene":         s["scene"],
        "jobs":          s["jobs"],
    }


# ── Floor plan ────────────────────────────────────────────────────────────────

@app.post("/session/{sid}/floorplan")
async def upload_floorplan(sid: str, file: UploadFile = File(...)):
    if sid not in sessions:
        raise HTTPException(404)
    content = await file.read()
    img     = Image.open(io.BytesIO(content)).convert("RGB")
    fname   = f"{sid}_floorplan.jpg"
    img.save(UPLOADS / fname, "JPEG", quality=95)
    sessions[sid]["floorplan"] = {
        "url": f"/uploads/{fname}", "width": img.width, "height": img.height,
    }
    return sessions[sid]["floorplan"]


# ── Cameras ───────────────────────────────────────────────────────────────────

class CameraIn(BaseModel):
    id:                str
    name:              str
    x:                 float
    y:                 float
    direction_deg:     float = 0.0
    fov_deg:           float = 90.0
    scene_description: str   = ""


@app.put("/session/{sid}/cameras")
async def set_cameras(sid: str, cameras: list[CameraIn]):
    if sid not in sessions:
        raise HTTPException(404)
    existing = {c["id"]: c for c in sessions[sid]["cameras"]}
    updated  = []
    for c in cameras:
        d = c.model_dump()
        if c.id in existing:
            d["base_image_path"] = existing[c.id].get("base_image_path")
            d["base_image_url"]  = existing[c.id].get("base_image_url")
        updated.append(d)
    sessions[sid]["cameras"] = updated
    sessions[sid]["jobs"]    = {}
    return {"camera_count": len(updated)}


@app.post("/session/{sid}/cameras/{cam_id}/image")
async def upload_camera_image(sid: str, cam_id: str, file: UploadFile = File(...)):
    if sid not in sessions:
        raise HTTPException(404)
    cam = next((c for c in sessions[sid]["cameras"] if c["id"] == cam_id), None)
    if cam is None:
        raise HTTPException(404, f"Camera {cam_id} not found")
    content = await file.read()
    img     = Image.open(io.BytesIO(content)).convert("RGB")
    fname   = f"{sid}_{cam_id}_base.jpg"
    img.save(UPLOADS / fname, "JPEG", quality=95)
    cam["base_image_path"] = str(UPLOADS / fname)
    cam["base_image_url"]  = f"/uploads/{fname}"
    return {"url": cam["base_image_url"]}


# ── Scene ─────────────────────────────────────────────────────────────────────

class WaypointIn(BaseModel):
    t: float
    x: float
    y: float


class SceneIn(BaseModel):
    actor_description: str              = "person wearing dark clothing"
    scenario:          str              = "suspicious activity"
    waypoints:         list[WaypointIn] = []
    duration:          float            = 5.0


@app.put("/session/{sid}/scene")
async def set_scene(sid: str, data: SceneIn):
    if sid not in sessions:
        raise HTTPException(404)
    sessions[sid]["scene"] = data.model_dump()
    sessions[sid]["jobs"]  = {}
    return {"ok": True}


# ── Generate ──────────────────────────────────────────────────────────────────

class GenSettings(BaseModel):
    num_frames:     int   = 81
    steps:          int   = 20
    guidance_scale: float = 5.0
    fps:            int   = 16
    width:          int   = 832
    height:         int   = 480
    seed:           int   = 42
    model_id:       str   = DEFAULT_MODEL


@app.post("/session/{sid}/generate")
async def generate(sid: str, req: GenSettings):
    if sid not in sessions:
        raise HTTPException(404)
    s = sessions[sid]
    if not s["cameras"]:
        raise HTTPException(400, "No cameras configured")
    if not s["scene"]:
        raise HTTPException(400, "No scene configured")

    from scene_engine import SceneEngine
    sc     = s["scene"]
    engine = SceneEngine(
        cameras=s["cameras"],
        actor_config={"description": sc["actor_description"], "scenario": sc["scenario"]},
        waypoints=sc["waypoints"],
        duration=sc["duration"],
    )
    scene_descs = {c["id"]: c.get("scene_description", "") for c in s["cameras"]}
    cam_prompts = engine.all_prompts(scene_descs)

    for cp in cam_prompts:
        cam = next((c for c in s["cameras"] if c["id"] == cp["camera_id"]), None)
        s["jobs"][cp["camera_id"]] = {
            "status":          "queued",
            "prompt":          cp["prompt"],
            "visible":         cp["visible"],
            "video_url":       None,
            "error":           None,
            "progress":        {"step": 0, "total": req.steps},
            "base_image_path": cam.get("base_image_path") if cam else None,
            "base_image_url":  cam.get("base_image_url")  if cam else None,
        }

    asyncio.create_task(_run_jobs(sid, req))
    return {"queued": list(s["jobs"].keys())}


@app.get("/session/{sid}/status")
async def status(sid: str):
    if sid not in sessions:
        raise HTTPException(404)
    return {"jobs": sessions[sid]["jobs"]}


# ── Worker call ───────────────────────────────────────────────────────────────

async def _call_worker(job: dict, req: GenSettings) -> str:
    """
    Send one generation job to the 8001 worker via WebSocket.
    Updates job["progress"] in real-time.
    Returns the video URL (e.g. "/worker-outputs/output_123.mp4").
    """
    image_data: Optional[str] = None
    img_path = job.get("base_image_path")
    if img_path and Path(img_path).exists():
        img = Image.open(img_path).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        image_data = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

    payload = {
        "prompt":         job["prompt"],
        "image":          image_data,
        "model_id":       req.model_id,
        "num_frames":     req.num_frames,
        "steps":          req.steps,
        "guidance_scale": req.guidance_scale,
        "fps":            req.fps,
        "width":          req.width,
        "height":         req.height,
        "seed":           req.seed,
        "preview_every":  4,
    }

    async with websockets.connect(
        WORKER_WS,
        max_size=None,
        open_timeout=10,
        close_timeout=10,
    ) as ws:
        await ws.send(json.dumps(payload))

        async for raw in ws:
            if isinstance(raw, bytes):
                continue  # worker can stream fMP4 chunks; we don't need them here
            msg = json.loads(raw)

            if msg["type"] == "progress":
                job["progress"] = {"step": msg["step"], "total": msg["total"]}

            elif msg["type"] == "done":
                # Worker URL is /outputs/output_xxx.mp4 — remap to /worker-outputs/
                url = msg["url"].replace("/outputs/", "/worker-outputs/", 1)
                return url

            elif msg["type"] == "error":
                raise RuntimeError(msg["message"])

            # ignore: status, ping

    raise RuntimeError("Worker closed connection without sending 'done'")


# ── Background job loop ───────────────────────────────────────────────────────

async def _run_jobs(sid: str, req: GenSettings):
    """Run queued jobs one at a time, proxying each to the 8001 worker."""
    s = sessions.get(sid)
    if not s:
        return

    for cam_id, job in list(s["jobs"].items()):
        if job["status"] != "queued":
            continue
        job["status"] = "generating"

        async with _job_queue:
            try:
                worker_url = await _call_worker(job, req)

                # worker_url is /worker-outputs/output_xxx.mp4
                # Copy to cctv/outputs/ with a descriptive name
                worker_filename = Path(worker_url).name          # output_xxx.mp4
                src = WORKER_OUTPUTS / worker_filename
                dst_name = f"{sid}_{cam_id}_{int(time.time())}.mp4"
                dst = OUTPUTS / dst_name

                if src.exists():
                    shutil.copy2(src, dst)
                    print(f"[cctv] saved {dst}")
                    local_url = f"/outputs/{dst_name}"
                else:
                    # Fall back to worker URL if copy fails
                    print(f"[cctv] warning: source file not found at {src}, using worker URL")
                    local_url = worker_url

                job["status"]    = "complete"
                job["video_url"] = local_url

            except websockets.exceptions.WebSocketException as exc:
                job["status"] = "failed"
                job["error"]  = f"Worker connection failed: {exc}. Is the 8001 worker running?"
            except Exception as exc:
                import traceback; traceback.print_exc()
                job["status"] = "failed"
                job["error"]  = str(exc)
