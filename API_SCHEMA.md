# Minority Report — API Schema

**Single source of truth for frontend ↔ backend contract.**

Both backend and frontend teams reference this file. No surprises at integration time.

---

## Shared Data Types (TypeScript)

```typescript
// Session
interface Session {
  session_id: string;
  building: Building | null;
  cameras: Camera[];
  simulation: Simulation | null;
  placement_complete: boolean;
}

// Building
interface Building {
  id: string;                              // e.g. "purdue-lawson"
  name: string;                            // e.g. "Lawson Computer Science Building"
  lat: number;
  lng: number;
  footprint_polygon: Array<[number, number]>;  // [[lat, lng], ...]
  splat_asset: string;                    // e.g. "lawson.splat"
}

// Camera
interface Camera {
  id: string;
  building_id: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    yaw: number;     // degrees, 0-360
    pitch: number;   // degrees, -90 to 90
  };
  fov: number;                            // field of view in degrees
  coverage_radius: number;                // meters
  placement_score: number;                // 0.0-1.0
}

// Simulation
interface Simulation {
  camera_id: string;
  status: "pending" | "generating" | "complete" | "failed";
  prompt: string;
  video_url: string | null;               // e.g. "/static/videos/session_id_camera_id.mp4"
  error?: string;                         // if status == "failed"
}

// API Response Wrapper (all endpoints)
interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}
```

---

## API Endpoints (FastAPI, Port 8000)

### 1. Session Management

#### POST `/session`
**Create a new session.**

- **Request Body:** `{}` (empty)
- **Response:** `200 OK`
  ```json
  {
    "session_id": "sess_abc123def456"
  }
  ```
- **Error Cases:**
  - `500 Internal Server Error` — session store failure

---

#### DELETE `/session/{session_id}`
**Clear session from memory.**

- **Path Params:** `session_id` (string)
- **Request Body:** None
- **Response:** `200 OK`
  ```json
  {
    "ok": true
  }
  ```
- **Error Cases:**
  - `404 Not Found` — session does not exist

---

### 2. Building Management

#### POST `/session/{session_id}/building`
**Set the active building for this session.**

- **Path Params:** `session_id` (string)
- **Request Body:**
  ```json
  {
    "building_id": "purdue-lawson",
    "name": "Lawson Computer Science Building",
    "lat": 40.4274,
    "lng": -86.9167,
    "footprint_polygon": [
      [40.4274, -86.9167],
      [40.4275, -86.9167],
      [40.4275, -86.9168],
      [40.4274, -86.9168]
    ]
  }
  ```
  - `building_id`: Either a pre-loaded ID (e.g., "purdue-lawson") or "custom"
  - `footprint_polygon`: GeoJSON ring (lat/lng pairs, closed ring)

- **Response:** `200 OK`
  ```json
  {
    "building": {
      "id": "purdue-lawson",
      "name": "Lawson Computer Science Building",
      "lat": 40.4274,
      "lng": -86.9167,
      "footprint_polygon": [[40.4274, -86.9167], ...],
      "splat_asset": "lawson.splat"
    }
  }
  ```

- **Error Cases:**
  - `400 Bad Request` — invalid footprint (not a closed ring, < 3 points, etc.)
  - `404 Not Found` — session does not exist
  - `500 Internal Server Error` — building store failure

---

#### GET `/session/{session_id}/building`
**Get the currently selected building for this session.**

- **Path Params:** `session_id` (string)
- **Response:** `200 OK`
  ```json
  {
    "building": {
      "id": "purdue-lawson",
      "name": "Lawson Computer Science Building",
      "lat": 40.4274,
      "lng": -86.9167,
      "footprint_polygon": [[40.4274, -86.9167], ...],
      "splat_asset": "lawson.splat"
    }
  }
  ```
  OR (if no building selected yet):
  ```json
  {
    "building": null
  }
  ```

- **Error Cases:**
  - `404 Not Found` — session does not exist

---

### 3. Camera Placement

#### POST `/session/{session_id}/cameras/place`
**Run the OR-Tools placement model to place cameras on the building.**

- **Path Params:** `session_id` (string)
- **Request Body:**
  ```json
  {
    "camera_count": 5
  }
  ```
  - `camera_count`: Number of cameras to place (1–50)

- **Response:** `200 OK`
  ```json
  {
    "cameras": [
      {
        "id": "cam_1",
        "building_id": "purdue-lawson",
        "position": {"x": 40.4274, "y": 25.5, "z": -86.9167},
        "rotation": {"yaw": 45.0, "pitch": -15.0},
        "fov": 60.0,
        "coverage_radius": 50.0,
        "placement_score": 0.92
      },
      ...
    ],
    "coverage_score": 0.88,
    "placement_complete": true
  }
  ```
  - `cameras`: Array of Camera objects with 3D positions + rotations
  - `coverage_score`: 0.0–1.0, how well the building is covered overall
  - All cameras returned; frontend selects which to render

- **Error Cases:**
  - `400 Bad Request` — `camera_count < 1 or > 50`, or building not set
  - `404 Not Found` — session does not exist
  - `500 Internal Server Error` — OR-Tools optimization failed

---

#### GET `/session/{session_id}/cameras`
**Get all placed cameras for this session.**

- **Path Params:** `session_id` (string)
- **Response:** `200 OK`
  ```json
  {
    "cameras": [
      {
        "id": "cam_1",
        "building_id": "purdue-lawson",
        "position": {"x": 40.4274, "y": 25.5, "z": -86.9167},
        "rotation": {"yaw": 45.0, "pitch": -15.0},
        "fov": 60.0,
        "coverage_radius": 50.0,
        "placement_score": 0.92
      }
    ],
    "placement_complete": true
  }
  ```
  - Returns empty array if no placement has been run

- **Error Cases:**
  - `404 Not Found` — session does not exist

---

#### GET `/session/{session_id}/cameras/{camera_id}`
**Get a single camera by ID.**

- **Path Params:** `session_id` (string), `camera_id` (string)
- **Response:** `200 OK`
  ```json
  {
    "camera": {
      "id": "cam_1",
      "building_id": "purdue-lawson",
      "position": {"x": 40.4274, "y": 25.5, "z": -86.9167},
      "rotation": {"yaw": 45.0, "pitch": -15.0},
      "fov": 60.0,
      "coverage_radius": 50.0,
      "placement_score": 0.92
    }
  }
  ```

- **Error Cases:**
  - `404 Not Found` — session or camera does not exist

---

### 4. Simulation

#### POST `/session/{session_id}/cameras/{camera_id}/simulate`
**Start an AI-generated simulation for a camera.**

- **Path Params:** `session_id` (string), `camera_id` (string)
- **Request Body:**
  ```json
  {
    "prompt": "simulate a robbery at night with rain"
  }
  ```
  - `prompt`: User-provided scenario text (any length, any keywords)

- **Response:** `202 Accepted` (async operation started)
  ```json
  {
    "simulation_id": "sim_abc123",
    "status": "pending",
    "camera_id": "cam_1",
    "prompt": "simulate a robbery at night with rain"
  }
  ```

- **Error Cases:**
  - `400 Bad Request` — `placement_complete == false` (must place cameras first)
  - `409 Conflict` — simulation already in progress for this camera
  - `404 Not Found` — session or camera does not exist

---

#### GET `/session/{session_id}/cameras/{camera_id}/simulation`
**Poll simulation status and retrieve result when complete.**

- **Path Params:** `session_id` (string), `camera_id` (string)
- **Response:** `200 OK` (always 200, check `status` field)
  ```json
  {
    "status": "pending",
    "prompt": "simulate a robbery at night with rain",
    "video_url": null
  }
  ```
  OR (when `status == "complete"`):
  ```json
  {
    "status": "complete",
    "prompt": "simulate a robbery at night with rain",
    "video_url": "/static/videos/sess_abc_cam_1.mp4"
  }
  ```
  OR (if `status == "failed"`):
  ```json
  {
    "status": "failed",
    "prompt": "simulate a robbery at night with rain",
    "video_url": null,
    "error": "Qwen model failed to generate video"
  }
  ```

- **Frontend polling:** Call this every 2 seconds until `status == "complete"` or `status == "failed"`

- **Error Cases:**
  - `404 Not Found` — session, camera, or simulation does not exist

---

### 5. Static Assets

#### GET `/static/videos/{filename}`
**Serve generated simulation videos.**

- **Path Params:** `filename` (string, e.g., `sess_abc_cam_1.mp4`)
- **Response:** `200 OK` with video file (MIME type: `video/mp4`)
- **Error Cases:**
  - `404 Not Found` — file not found

---

#### GET `/static/splats/{filename}`
**Serve Gaussian splat assets (optional — can be served from Next.js `/public` instead).**

- **Path Params:** `filename` (string, e.g., `lawson.splat`)
- **Response:** `200 OK` with `.splat` binary
- **Error Cases:**
  - `404 Not Found` — file not found

---

## Pre-Loaded Buildings (Frontend Reference)

These are hardcoded in `frontend/lib/buildings.ts` and also in backend `api/src/session_store.py`.

```typescript
const PRELOADED_BUILDINGS = [
  {
    id: "purdue-lawson",
    name: "Lawson Computer Science Building",
    lat: 40.4274,
    lng: -86.9167,
    footprint_polygon: [
      [40.42740, -86.91670],
      [40.42750, -86.91660],
      [40.42750, -86.91680],
      [40.42740, -86.91680]
    ],
    splat_asset: "lawson.splat"
  },
  {
    id: "purdue-pmu",
    name: "Purdue Memorial Union",
    lat: 40.4256,
    lng: -86.9094,
    footprint_polygon: [
      [40.42560, -86.90940],
      [40.42570, -86.90930],
      [40.42570, -86.90950],
      [40.42560, -86.90950]
    ],
    splat_asset: "pmu.splat"
  },
  {
    id: "purdue-armstrong",
    name: "Armstrong Hall",
    lat: 40.4268,
    lng: -86.9145,
    footprint_polygon: [
      [40.42680, -86.91450],
      [40.42690, -86.91440],
      [40.42690, -86.91460],
      [40.42680, -86.91460]
    ],
    splat_asset: "armstrong.splat"
  }
];
```

---

## Frontend → Backend Call Order (Happy Path)

1. **POST `/session`** → Get `session_id`, store in `localStorage`
2. **POST `/session/{session_id}/building`** → User clicks building on globe
3. **POST `/session/{session_id}/cameras/place`** → User submits camera budget
4. **GET `/session/{session_id}/cameras`** → Render camera pins on building view
5. **GET `/session/{session_id}/cameras/{camera_id}`** → Load single camera for 3D view
6. **POST `/session/{session_id}/cameras/{camera_id}/simulate`** → User submits prompt
7. **GET `/session/{session_id}/cameras/{camera_id}/simulation`** (poll every 2s) → Wait for video
8. **GET `/static/videos/{filename}`** → Play video when ready

---

## CORS & Headers

**Backend CORS policy:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

**All endpoints accept/return:** `Content-Type: application/json`

---

## Error Response Format (All Endpoints)

On any error, return:
```json
{
  "error": "Error description",
  "detail": "Optional detailed reason"
}
```

Example:
```json
{
  "error": "placement_not_complete",
  "detail": "Cannot simulate before cameras are placed"
}
```

---

## Mock/Stub Data for Frontend Development

If backend is not ready, frontend can use these stubs:

```typescript
// Mock session
const mockSession = {
  session_id: "sess_demo_001"
};

// Mock building response
const mockBuilding = {
  id: "purdue-lawson",
  name: "Lawson Computer Science Building",
  lat: 40.4274,
  lng: -86.9167,
  footprint_polygon: [[40.4274, -86.9167], [40.4275, -86.9167], [40.4275, -86.9168], [40.4274, -86.9168]],
  splat_asset: "lawson.splat"
};

// Mock cameras (after placement)
const mockCameras = [
  {
    id: "cam_1",
    building_id: "purdue-lawson",
    position: { x: 40.4274, y: 25.5, z: -86.9167 },
    rotation: { yaw: 45, pitch: -15 },
    fov: 60,
    coverage_radius: 50,
    placement_score: 0.92
  },
  {
    id: "cam_2",
    building_id: "purdue-lawson",
    position: { x: 40.4275, y: 25.5, z: -86.9168 },
    rotation: { yaw: 135, pitch: -20 },
    fov: 60,
    coverage_radius: 45,
    placement_score: 0.85
  }
];

// Mock simulation (polling states)
const mockSimulationPending = {
  status: "pending",
  prompt: "simulate a robbery at night",
  video_url: null
};

const mockSimulationComplete = {
  status: "complete",
  prompt: "simulate a robbery at night",
  video_url: "/static/videos/sess_demo_001_cam_1.mp4"
};
```

---

## Development Tips

- **Frontend:** Use the mock data above while backend scaffolding is in progress. Swap real API calls in once endpoints are ready.
- **Backend:** Implement endpoints in order: Session → Building → Placement → Simulation. Each layer builds on the previous.
- **Both:** Keep session_id in `localStorage` on the client, keyed `"minority_report_session"`.
- **Integration:** Test the full happy path once both teams are live.
