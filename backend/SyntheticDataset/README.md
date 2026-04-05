# SyntheticDataset — Video Generation Tools

Two tools for generating synthetic surveillance video using diffusion models (Wan I2V/T2V, HunyuanVideo). Both share the same Python venv and the same model worker process.

```
SyntheticDataset/
├── backend/          VideoGen — single-camera I2V/T2V generation UI
├── frontend/         VideoGen browser UI (vanilla HTML/JS)
├── cctv/             Multi-camera CCTV dataset generator
├── start.sh          Start VideoGen (worker + app together)
├── start_worker.sh   Start only the model worker (port 8001)
└── start_app.sh      Start only the web app (port 8000)
```

---

## VideoGen

A browser UI for generating videos from text prompts or image+text (image-to-video). Supports Wan 2.2 I2V, Wan 2.1 I2V/T2V, and HunyuanVideo I2V.

### Architecture

Two processes communicate over WebSocket on `localhost:8001`:

```
Browser ──WS /ws──▶ app.py (port 8000) ──WS──▶ worker.py (port 8001)
                    (proxy, no ML)              (holds model in VRAM)
```

The worker loads the model once and keeps it hot. The app is a lightweight proxy that can be restarted without touching the model. Generation progress (step count + preview frame) streams back to the browser in real time.

### Setup

```bash
python -m venv video-gen/.venv
source video-gen/.venv/bin/activate
pip install -r backend/requirements.txt
```

### Running

**Both processes in one terminal:**
```bash
./start.sh
```

**Separate terminals (recommended for development):**
```bash
# Terminal 1 — start worker once, leave it running
./start_worker.sh

# Terminal 2 — restart freely without losing the loaded model
./start_app.sh
```

Open `http://localhost:8000`.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_ID` | `Wan-AI/Wan2.2-I2V-A14B-Diffusers` | HuggingFace model ID to preload |
| `PORT` | `8000` | Web app port |
| `WORKER_PORT` | `8001` | Worker internal port |

### Generation parameters

Sent by the browser to the worker via WebSocket:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `prompt` | — | Text prompt (required) |
| `image` | `null` | Base64 JPEG data URL for I2V |
| `num_frames` | `17` | Number of output frames |
| `steps` | `20` | Diffusion inference steps |
| `guidance_scale` | `5.0` | Classifier-free guidance scale |
| `fps` | `16` | Output video frame rate |
| `width` / `height` | `832` / `480` | Output resolution |
| `seed` | `-1` | Random seed (`-1` = random) |

### Worker API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{"status": "ready"/"busy", "model": "..."}` |
| `WS` | `/generate` | Stream generation request and receive progress + video URL |

---

## CCTV Dataset Generator

Generates consistent multi-camera CCTV footage of a single actor moving through a scene. Place cameras on a floor plan, define an actor path as timed waypoints, and the tool generates one video per camera — each showing the actor from that camera's perspective with a consistent appearance description.

**Requires the VideoGen worker (`start_worker.sh`) to be running on port 8001.**

### Running

```bash
# From the cctv/ directory
PORT=8002 ./start.sh
```

Open `http://localhost:8002`.

### Workflow

1. **Upload a floor plan** image
2. **Place cameras** — set position, direction, and FOV for each camera
3. **Upload a base image** per camera (optional) — used as the I2V conditioning frame
4. **Define the scene** — actor description, scenario, and timed waypoints
5. **Generate** — the `SceneEngine` builds per-camera prompts that describe the actor's position relative to each camera view; videos are generated sequentially via the 8001 worker

### REST API (port 8002)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/session` | Create a session |
| `GET` | `/session/{sid}` | Get session state |
| `POST` | `/session/{sid}/floorplan` | Upload floor plan image |
| `PUT` | `/session/{sid}/cameras` | Set all cameras |
| `POST` | `/session/{sid}/cameras/{id}/image` | Upload base image for a camera |
| `PUT` | `/session/{sid}/scene` | Set actor description, scenario, waypoints |
| `POST` | `/session/{sid}/generate` | Start generation for all cameras |
| `GET` | `/session/{sid}/status` | Poll job status per camera |

### Scene consistency

`cctv/backend/scene_engine.py` computes each camera's view of the actor at the midpoint of the clip. Based on the actor's normalized (x, y) position and the camera's direction + FOV, it determines:

- Whether the actor is **visible** in this camera's cone
- The actor's **relative position** (left/center/right, near/mid/far)
- The actor's **direction of travel** relative to the camera

This information is composed into a natural language prompt that keeps actor appearance consistent across all views.

## Files

| File | Purpose |
|------|---------|
| `backend/app.py` | VideoGen web app — WebSocket proxy to worker, serves frontend |
| `backend/worker.py` | Model worker — holds pipeline in VRAM, streams generation |
| `backend/pipeline.py` | Wan/HunyuanVideo pipeline loader and `run_generation()` |
| `backend/requirements.txt` | Python dependencies |
| `frontend/index.html` | VideoGen browser UI |
| `cctv/backend/app.py` | CCTV dataset generator FastAPI app (port 8002) |
| `cctv/backend/scene_engine.py` | Per-camera prompt builder with actor path interpolation |
| `cctv/frontend/index.html` | CCTV generator browser UI |
| `cctv/start.sh` | Start CCTV app (reuses VideoGen venv) |
| `start.sh` | Start VideoGen worker + app together |
| `start_worker.sh` | Start model worker only |
| `start_app.sh` | Start web app only |
