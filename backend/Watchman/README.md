# Watchman — AI Security Monitor

Real-time AI security monitoring dashboard. A background poll loop continuously feeds synthetic camera scene descriptions to Qwen2.5-VL, which classifies each scene as safe or an incident. Detected incidents are broadcast live to all connected browser clients via WebSocket and trigger automatic emergency dispatch messages.

## Architecture

```
Browser (Next.js)
      │  WebSocket /ws
      ▼
FastAPI (port 8002)
  ├── poll loop — round-robin over 6 cameras, one analysis every ~2.5s
  ├── ThreadPoolExecutor — runs Qwen inference off the event loop
  └── broadcast() — pushes updates to all WebSocket clients
```

The app is a single process: FastAPI serves the REST API, WebSocket connections, and the built Next.js frontend. The Qwen model loads at startup in a background thread.

## Setup

```bash
cd backend
pip install -r requirements.txt
```

The Qwen2.5-VL model (`Qwen/Qwen2.5-VL-7B-Instruct`) is downloaded from HuggingFace on first run. Set `QWEN_MODEL_ID` to use a different model.

## Running

```bash
./start.sh
```

Or manually:

```bash
cd backend
QWEN_MODEL_ID=Qwen/Qwen2.5-VL-7B-Instruct \
PORT=8002 \
WATCHMAN_POLL_INTERVAL=15 \
python3 -m uvicorn app:app --host 0.0.0.0 --port 8002
```

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `QWEN_MODEL_ID` | `Qwen/Qwen2.5-VL-7B-Instruct` | HuggingFace model ID |
| `PORT` | `8002` | API/WebSocket port |
| `WATCHMAN_POLL_INTERVAL` | `15` | Seconds for a full cycle across all cameras |

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Model status, camera count |
| `GET` | `/cameras` | All cameras with current status |
| `GET` | `/cameras/{id}` | Single camera |
| `POST` | `/cameras/{id}/resolve` | Manually resolve an active incident |
| `POST` | `/cameras/{id}/analyze` | Trigger an immediate Qwen analysis (demo) |
| `GET` | `/incidents` | All active (unresolved) incidents |
| `GET` | `/dispatch` | Dispatch log (last 100 entries) |
| `POST` | `/query` | Answer a natural language question about the incident log |
| `WS` | `/ws` | Live event stream |

### WebSocket messages

The server pushes JSON objects:

| `type` | Payload | When |
|--------|---------|------|
| `snapshot` | Full state (cameras, active incidents, dispatch log) | On connect |
| `incident_detected` | `camera`, `incident`, `dispatch` | New incident found |
| `incident_resolved` | `cameraId`, `incidentId`, `resolvedAt` | Incident cleared |
| `camera_ok` | `cameraId`, `analyzedAt` | Clean scan result |
| `ping` | — | Keepalive every 20s |

### `/query` example

```bash
curl -X POST http://localhost:8002/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How many fire incidents have been detected today?"}'
```

## Incident types

| Type | Service dispatched |
|------|--------------------|
| `crime_assault` | Police (911) |
| `fire_smoke` | Fire Dept (911) |
| `unauthorized_access` | Security |
| `medical_emergency` | EMS (911) |

## Mock cameras

Six synthetic cameras are defined in `backend/scenes.py`. Each has 8 scene variants — 7 nominal and 1 incident-seeded — giving roughly 1-in-8 odds of triggering an alarm per analysis cycle.

| Camera | Location | Incident type |
|--------|----------|---------------|
| CAM-01 | Main Entrance | Fire / Smoke |
| CAM-02 | Parking Garage B2 | Unauthorized Access |
| CAM-03 | Server Room Corridor | Unauthorized Access |
| CAM-04 | Rooftop HVAC | Fire / Smoke |
| CAM-05 | Loading Dock | Crime / Assault |
| CAM-06 | Cafeteria | Medical Emergency |

## Files

| File | Purpose |
|------|---------|
| `backend/app.py` | FastAPI entry point, WebSocket manager, REST routes |
| `backend/worker.py` | Background poll loop, dispatch message builder |
| `backend/model.py` | Qwen2.5-VL loader, `run_analysis()`, `run_query()` |
| `backend/state.py` | In-memory state (cameras, incidents, dispatch log) |
| `backend/scenes.py` | Synthetic scene descriptions per camera |
| `backend/requirements.txt` | Python dependencies |
| `frontend/` | Next.js dashboard (built output served by FastAPI) |
| `start.sh` | One-command launcher |
