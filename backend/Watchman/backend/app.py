"""
Watchman — FastAPI app.

Single process: serves REST endpoints, manages WebSocket connections,
loads the Qwen model at startup, and runs the background poll loop.

Port: 8002 (configurable via PORT env var)
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import model
import state
import worker

# ── Paths ─────────────────────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIR / "index.html"
FRONTEND_DEV_INDEX = Path(__file__).parent.parent / "frontend" / "index.html"

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="qwen")

# ── WebSocket connection manager ──────────────────────────────────────────────

_connections: set[WebSocket] = set()


async def broadcast(message: dict) -> None:
    if not _connections:
        return
    text = json.dumps(message)
    dead = set()
    for ws in _connections:
        try:
            await ws.send_text(text)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init worker with broadcast fn and executor
    worker.init(broadcast, _executor)

    # Load Qwen model in executor (non-blocking to event loop)
    loop = asyncio.get_event_loop()
    state.set_model_status("loading")
    try:
        await loop.run_in_executor(_executor, model.load_model)
        state.set_model_status("ready")
        print("[app] model ready — starting poll loop")
    except Exception as exc:
        state.set_model_status("error")
        print(f"[app] model load error: {exc}")

    # Start background poll loop
    poll_task = asyncio.create_task(worker.poll_loop())

    yield

    # Shutdown
    poll_task.cancel()
    try:
        await poll_task
    except asyncio.CancelledError:
        pass
    _executor.shutdown(wait=False)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Watchman", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve built frontend assets if they exist
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")


# ── Frontend ──────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    if FRONTEND_INDEX.exists():
        return FileResponse(FRONTEND_INDEX)
    if FRONTEND_DEV_INDEX.exists():
        return FileResponse(FRONTEND_DEV_INDEX)
    return JSONResponse({"message": "Watchman API running. Frontend not built yet."})


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": model.MODEL_ID,
        "modelStatus": state.get_model_status(),
        "cameras": len(state.cameras),
    }


# ── Camera endpoints ──────────────────────────────────────────────────────────

@app.get("/cameras")
async def get_cameras():
    return {"cameras": [c.to_dict() for c in state.cameras.values()]}


@app.get("/cameras/{camera_id}")
async def get_camera(camera_id: str):
    cam = state.cameras.get(camera_id)
    if not cam:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return {"camera": cam.to_dict()}


@app.post("/cameras/{camera_id}/resolve")
async def resolve_camera(camera_id: str):
    if camera_id not in state.cameras:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    import time
    incident_id = state.resolve_incident(camera_id)
    if incident_id:
        await broadcast({
            "type": "incident_resolved",
            "cameraId": camera_id,
            "incidentId": incident_id,
            "resolvedAt": time.time() * 1000,
        })
    return {"ok": True, "resolved": incident_id is not None}


@app.post("/cameras/{camera_id}/analyze")
async def trigger_analysis(camera_id: str):
    """Trigger an immediate Qwen analysis for demo purposes."""
    cam = state.cameras.get(camera_id)
    if not cam:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    if not model.is_loaded():
        return JSONResponse({"error": "Model not ready"}, status_code=503)

    import random
    import time
    import uuid

    scene = random.choice(cam.scene_pool)
    loop = asyncio.get_event_loop()

    try:
        raw = await loop.run_in_executor(_executor, model.run_analysis, scene)
        result = model.parse_response(raw)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)

    now = time.time()

    if result and result.get("incident") and cam.status != "incident":
        incident = state.Incident(
            id=uuid.uuid4().hex[:8],
            camera_id=camera_id,
            type=result["type"],
            severity=result.get("severity", "medium"),
            description=result.get("description") or worker._default_description(result["type"]),
            detected_at=now,
            dispatched=True,
        )
        dispatch = worker._make_dispatch(cam, incident, now)
        state.record_incident(camera_id, incident, dispatch)
        await broadcast({
            "type": "incident_detected",
            "camera": state.cameras[camera_id].to_dict(),
            "incident": incident.to_dict(),
            "dispatch": dispatch.to_dict(),
        })
    else:
        state.mark_analyzed(camera_id)
        await broadcast({
            "type": "camera_ok",
            "cameraId": camera_id,
            "analyzedAt": now * 1000,
        })

    return {"ok": True, "result": result}


# ── Incidents ─────────────────────────────────────────────────────────────────

@app.get("/incidents")
async def get_incidents():
    return {"incidents": [i.to_dict() for i in state.incidents.values()]}


# ── Natural Language Query ─────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str


@app.post("/query")
async def query_incidents(body: QueryRequest):
    """
    Answer a natural language question about the incident log using Qwen.
    The full incident history is passed as context.
    """
    question = body.question.strip()
    if not question:
        return JSONResponse({"error": "Question cannot be empty"}, status_code=400)
    if not model.is_loaded():
        return JSONResponse({"error": "Model not ready yet — try again shortly"}, status_code=503)

    context = state.build_query_context()
    loop = asyncio.get_event_loop()
    try:
        answer = await loop.run_in_executor(_executor, model.run_query, question, context)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)

    return {"answer": answer, "question": question}


# ── Dispatch log ──────────────────────────────────────────────────────────────

@app.get("/dispatch")
async def get_dispatch():
    return {"dispatch": [d.to_dict() for d in state.dispatch_log]}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _connections.add(ws)

    # Send full state snapshot on connect
    snapshot = state.get_snapshot()
    snapshot["type"] = "snapshot"
    await ws.send_text(json.dumps(snapshot))

    # Keep alive with periodic pings
    async def keepalive():
        while True:
            await asyncio.sleep(20)
            try:
                await ws.send_text(json.dumps({"type": "ping"}))
            except Exception:
                break

    ping_task = asyncio.create_task(keepalive())
    try:
        while True:
            # We don't expect messages from the client, but we need to
            # keep receiving to detect disconnects
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        ping_task.cancel()
        _connections.discard(ws)
