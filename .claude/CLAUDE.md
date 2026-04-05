@frontend-agents.md

# Minority Report — Shared Development Guide

## Project Overview

Minority Report automates the installation and simulation of surveillance cameras. Users select a building from a satellite globe view, input a camera budget, and an optimization model automatically places cameras at optimal positions. Users can then step through each camera in a 3D Gaussian splat view and prompt AI-generated video simulations of scenarios (crime, bad weather, etc.).

**Think of it as:** "Secure. Simulate. Save."

**This conversation is the spec.** There is no separate PRD.

---

## Development Principles

**KISS — Keep It Simple.** Every decision should favor the simplest implementation that demos well. No over-engineering.

**YAGNI — You Aren't Gonna Need It.** Do not build: user authentication, database persistence, admin panels, real camera hardware integration, multi-building persistence across sessions, cloud deployment, or anything not described in this file.

**Tests:** Skip entirely. This is a 36-hour hackathon. Ship fast.

**Agent policy:** Build and iterate fast. Don't ask — implement, run, fix.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                            │
│                                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Globe View  │──▶│Building View │──▶│  Camera View     │  │
│  │  (CesiumJS)  │    │(Camera Pins) │    │(Three.js Splat)  │  │
│  │              │    │              │    │                  │  │
│  │ Satellite    │    │ OR-Tools     │    │ FNAF switcher    │  │
│  │ Earth        │    │ placement    │    │ Chat prompt UI   │  │
│  │ Click bldg   │    │ result pins  │    │ Video playback   │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                   │                     │            │
└─────────┼───────────────────┼─────────────────────┼────────────┘
          │     HTTP API      │                     │
          ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI (Port 8000)                         │
│                                                                 │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │   Session   │  │  Placement Model │  │  Simulation Svc   │   │
│  │   Store     │  │  (OR-Tools)      │  │  (Wan local)      │   │
│  │  (in-memory)│  │                  │  │                   │   │
│  │  sessions{} │  │  Coverage optim  │  │  Frame capture    │   │
│  │  buildings  │  │  greedy + ILP    │  │  → Qwen video gen │   │
│  │  cameras    │  │  returns (x,y,z) │  │  → video file     │   │
│  └─────────────┘  └──────────────────┘  └───────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nvidia DGX (Local)                          │
│  Qwen 2.5 video generation model (runs on GPU)                  │
│  .splat asset files for Purdue buildings                        │
└─────────────────────────────────────────────────────────────────┘
```

**Key architectural decision:** The simulation engine is fully isolated from the camera placement model. Placement and simulation are independent operations — placement runs once per session/building, simulation runs per-camera per-prompt.

**Critical constraint:** Simulation endpoints are only callable after camera placement has completed for the session.

---

## How to Run Locally

```bash
# 1. Start FastAPI backend (terminal 1)
cd api
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
# Runs on http://localhost:8000

# 2. Start Next.js frontend (terminal 2)
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000

# 3. Ensure Qwen model is loaded on DGX
#    See api/services/simulation.py for model path config
```

### Technical Setup Notes

- `.splat` files for Purdue buildings go in `frontend/public/splats/`
- Qwen model path is set via `QWEN_MODEL_PATH` in `.env`
- No database setup required — all state is in-memory per session
- CesiumJS Ion token required for satellite tiles (free tier)

---

## Environment Variables

```bash
# .env (root level)

# CesiumJS Ion access token (free tier — https://ion.cesium.com)
CESIUM_ION_TOKEN=your_token_here

# Qwen model path on DGX filesystem
QWEN_MODEL_PATH=/path/to/qwen2.5-model

# FastAPI
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000

# Next.js (prefix with NEXT_PUBLIC_ for browser access)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_token_here
```

---

## Data Shapes (In-Memory Session State)

No SQL schema — all state lives in Python dicts keyed by `session_id`.

```python
# Session store shape
sessions = {
    "session_id": {
        "building": {
            "id": str,
            "name": str,                    # e.g. "Lawson Computer Science Building"
            "lat": float,
            "lng": float,
            "footprint_polygon": [[lat, lng], ...],  # GeoJSON ring
            "splat_asset": str,             # filename in /public/splats/
        },
        "cameras": [
            {
                "id": str,
                "position": {"x": float, "y": float, "z": float},
                "rotation": {"yaw": float, "pitch": float},
                "fov": float,               # degrees
                "coverage_radius": float,   # meters
                "placement_score": float,   # OR-Tools coverage score
            }
        ],
        "simulation": {
            "camera_id": str,
            "status": "pending" | "generating" | "complete" | "failed",
            "prompt": str,
            "video_path": str | None,       # served from /static/
        } | None,
        "placement_complete": bool,
    }
}
```

---

## Pre-Loaded Purdue Campus Buildings

These buildings ship with the app. `.splat` files are bundled in `frontend/public/splats/`.

| id | name | lat | lng | splat_asset |
|----|------|-----|-----|-------------|
| `purdue-lawson` | Lawson Computer Science Building | 40.4274 | -86.9167 | lawson.splat |
| `purdue-pmu` | Purdue Memorial Union | 40.4256 | -86.9094 | pmu.splat |
| `purdue-armstrong` | Armstrong Hall | 40.4268 | -86.9145 | armstrong.splat |

These are available without any user action — the globe loads with Purdue campus in view and these buildings are clickable immediately.

---

## FastAPI API Endpoints (Port 8000)

### Session

```
POST /session
  → { session_id: str }
  Creates a new in-memory session.

DELETE /session/{session_id}
  → { ok: true }
  Clears session from memory.
```

### Building

```
POST /session/{session_id}/building
  Body: {
    building_id: str          # matches pre-loaded building id OR "custom"
    name: str,
    lat: float,
    lng: float,
    footprint_polygon: [[float, float], ...]
  }
  → { building: BuildingShape }
  Sets the active building for the session.

GET /session/{session_id}/building
  → { building: BuildingShape | null }
```

### Camera Placement

```
POST /session/{session_id}/cameras/place
  Body: { camera_count: int }
  → {
      cameras: [CameraShape, ...],
      coverage_score: float,    # 0.0–1.0, how well the building is covered
      placement_complete: true
    }
  Runs OR-Tools optimization. Blocks until complete (fast enough for demo).
  Error 400 if camera_count < 1 or building not set.

GET /session/{session_id}/cameras
  → { cameras: [CameraShape, ...], placement_complete: bool }

GET /session/{session_id}/cameras/{camera_id}
  → { camera: CameraShape }
  Error 404 if camera not found.
```

### Simulation

```
POST /session/{session_id}/cameras/{camera_id}/simulate
  Body: { prompt: str }         # e.g. "simulate a robbery at night"
  → { simulation_id: str, status: "pending" }
  Captures current camera view frame, sends to Qwen with prompt.
  Error 400 if placement not complete.
  Error 409 if simulation already in progress.

GET /session/{session_id}/cameras/{camera_id}/simulation
  → {
      status: "pending" | "generating" | "complete" | "failed",
      prompt: str,
      video_url: str | null     # /static/videos/{filename}.mp4 when complete
    }
  Poll this until status == "complete".
```

### Static Assets

```
GET /static/videos/{filename}   # Serve generated simulation videos
GET /static/splats/{filename}   # Serve .splat files (or serve from Next.js /public)
```

---

## Camera Placement Model (OR-Tools)

**File:** `api/services/placement.py`

Uses Google OR-Tools with a greedy coverage maximization approach:

1. Discretize the building footprint into a grid of coverage points
2. For each candidate camera position (sampled from grid + corners + entry points):
   - Compute coverage radius and angular sweep
   - Score by number of grid points covered
3. Run greedy set-cover selection until `camera_count` cameras placed
4. Return positions with yaw/pitch aimed at building centroid

```python
# Input
building_footprint: list[tuple[float, float]]  # polygon vertices
camera_count: int

# Output
cameras: list[dict]  # position (x,y,z), rotation (yaw,pitch), fov, coverage_radius, score
```

**Constraint:** Cameras are placed on walls/corners at ~2.5m height, angled inward. Never placed outside the building footprint.

---

## Simulation Service (Qwen)

**File:** `api/services/simulation.py`

Flow:
1. Receive `camera_id` + `prompt`
2. Look up camera position from session
3. Generate a synthetic "frame" description from camera position metadata (or capture a render if Three.js frame export is implemented)
4. Call Qwen locally on DGX with: `[frame_context] + [user_prompt]` → generate video
5. Save output video to `api/static/videos/{session_id}_{camera_id}.mp4`
6. Update session simulation status to `complete`

```python
# Qwen call (runs locally on DGX)
model = Qwen25VideoGen(model_path=QWEN_MODEL_PATH)
video = model.generate(
    prompt=f"Security camera view of {building_name}. {user_prompt}",
    context_image=frame_bytes,   # if available
    duration_seconds=5,
)
```

**Async:** Simulation runs in a background thread. Frontend polls `GET .../simulation` every 2 seconds until `status == complete`.

---

## Frontend Pages (Next.js)

Single Next.js app with client-side view transitions. Three views — no page reloads, seamless zoom from globe to camera.

### View 1: Globe (`/`)

- **Component:** `GlobeView`
- **Library:** CesiumJS via `resium` (React wrapper)
- **Behavior:**
  - Loads satellite imagery centered on Purdue campus (lat: 40.4274, lng: -86.9167, altitude: 800m)
  - Pre-loaded buildings rendered as clickable 3D markers/pins
  - On click: creates session (`POST /session`), sets building (`POST /session/:id/building`), transitions to Building View
- **Data:** Pre-loaded building list hardcoded in `lib/buildings.ts`

### View 2: Building (`/building`)

- **Component:** `BuildingView`
- **Behavior:**
  - Shows top-down floor plan / aerial view of selected building
  - Input: "How many cameras can you afford?" → number input → submit
  - Calls `POST /session/:id/cameras/place`
  - Renders camera pins on the floor plan at returned positions
  - Each pin is clickable → transitions to Camera View
  - Shows `coverage_score` as a percentage badge
- **Data:** Session cameras from `GET /session/:id/cameras`

### View 3: Camera (`/camera/[id]`)

- **Component:** `CameraView`
- **Behavior:**
  - Loads `.splat` file for the building using `mkkellogg/GaussianSplats3D`
  - Camera is positioned and oriented to match the selected camera's `position` + `rotation`
  - **FNAF-style thumbnail strip** at bottom: one thumbnail per camera, click to switch
  - **Chat prompt input** at bottom center: user types scenario → hits Enter
  - Calls `POST /session/:id/cameras/:cam_id/simulate` with prompt
  - Polls `GET .../simulation` every 2s → when complete, plays video in an overlay
  - Video overlay closes on click, returns to 3D splat view
- **Data:** Camera list from session, `.splat` from `/public/splats/{building}.splat`

### View Transitions

```
Globe ──(click building)──▶ Building ──(click camera pin)──▶ Camera
                                 ▲                               │
                                 └──────(FNAF thumbnail)─────────┘
```

Use `framer-motion` for smooth fade/zoom transitions between views.

---

## Directory Structure

```
MinorityReport/
├── api/
│   ├── app.py                      # FastAPI entry point, CORS, routes
│   ├── requirements.txt
│   ├── .env
│   └── src/
│       ├── session_store.py         # In-memory sessions dict + helpers
│       ├── routes/
│       │   ├── session.py           # POST/DELETE /session
│       │   ├── building.py          # GET/POST /session/:id/building
│       │   ├── cameras.py           # placement + camera CRUD
│       │   └── simulation.py        # simulate + poll
│       └── services/
│           ├── placement.py         # OR-Tools camera placement model
│           └── simulation.py        # Qwen video generation service
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Globe view (/)
│   │   ├── building/
│   │   │   └── page.tsx             # Building view (/building)
│   │   └── camera/
│   │       └── [id]/
│   │           └── page.tsx         # Camera view (/camera/:id)
│   ├── components/
│   │   ├── GlobeView.tsx            # CesiumJS globe
│   │   ├── BuildingView.tsx         # Floor plan + camera pins
│   │   ├── CameraView.tsx           # Three.js Gaussian splat viewer
│   │   ├── FNAFSwitcher.tsx         # Thumbnail strip at bottom
│   │   ├── SimulationPrompt.tsx     # Chat input + video overlay
│   │   └── CoverageBadge.tsx        # Coverage score display
│   ├── lib/
│   │   ├── api.ts                   # All fetch calls to FastAPI
│   │   ├── buildings.ts             # Pre-loaded Purdue building data
│   │   └── session.ts               # Session ID management (localStorage)
│   ├── public/
│   │   └── splats/
│   │       ├── lawson.splat
│   │       ├── pmu.splat
│   │       └── armstrong.splat
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── .env.example
├── CLAUDE.md
└── README.md
```

---

## Git Workflow

- **Branch:** `main` only
- **Commits:** Present tense ("Add OR-Tools placement service", "Wire FNAF camera switcher")
- **No PRs, no reviews** — push directly to main

---

## Deployment

Local only. Demo runs on the Nvidia DGX.

- Backend: `uvicorn app:app --port 8000`
- Frontend: `npm run dev` or `npm run build && npm start`
- Judges access via browser on the same machine or local network IP
