# MINORITY REPORT: FRONTEND REQUIREMENTS

## THIS FILE IS THE COMPLETE SPEC FOR THE FRONTEND. EVERYTHING YOU NEED IS HERE.

---

## Project Overview

Minority Report is an AI surveillance platform for a 36-hour hackathon. Users select a Purdue campus building from a satellite globe, set a camera budget, an optimization model places cameras at optimal positions, and users step through each camera in a 3D Gaussian splat view to prompt AI-generated video simulations of security scenarios.

**Tagline:** "Secure. Simulate. Save."

**Repo:** github.com/mihir-chauhan/MinorityReport

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript strict)
- **Globe:** CesiumJS (direct import, NOT resium)
- **3D Viewer:** Three.js + @mkkellogg/gaussian-splats-3d for .splat files
- **Styling:** Tailwind CSS v4 + CSS custom properties
- **Animations:** framer-motion for view transitions
- **Fonts:** Space Mono (monospace, all HUD/data text), Inter (UI body text)
- **State:** localStorage for session ID and selected building

---

## Design Direction

### Aesthetic: Military Intelligence HUD / Spy-Thriller

Reference: Bilawal Sidhu's WorldView (worldview.aiastras.com). Dark tactical command center aesthetic.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| --color-bg | #0a0a0a | Pure black background everywhere |
| --color-surface | #111111 | Panel backgrounds |
| --color-accent-cyan | #00e5ff | Primary accent: interactive elements, borders, HUD chrome |
| --color-accent-green | #00ff41 | Secondary accent: status indicators, success states |
| --color-text | #c8d6e5 | Body text |
| --color-text-dim | #4a5568 | Dim labels, timestamps |
| --color-border | rgba(0,229,255,0.12) | Subtle borders |
| Red | #ff003c | Alerts, REC indicator, errors |

### Typography

- ALL HUD elements, labels, readouts, coordinates, status text: Space Mono (monospace)
- Only longer descriptive paragraphs: Inter (sans-serif)
- All text UPPERCASE throughout the interface
- Letter-spacing: 0.05-0.3em for labels

### Effects (defined in globals.css)

- `.glow-cyan` / `.glow-green`: Text shadow glow (3-layer cascade)
- `.glow-cyan-box` / `.glow-green-box`: Box shadow glow for panels
- `.scanlines`: Fixed full-screen scanline overlay (repeating gradient)
- `.flicker`: Subtle opacity animation (8s period)
- `.hud-pulse`: Opacity pulse 0.7-1.0 (2.4s)
- `.cursor-blink`: Underscore blink animation
- `.bracket-panel`: CSS pseudo-element corner brackets on panels
- `.nv-grain::after`: Night vision noise texture overlay
- `.crt-vignette::before`: Radial gradient edge darkening
- `.radar-ping`: Scale pulse animation for markers
- `.scanner-line`: Horizontal sweep animation
- `@media (prefers-reduced-motion: reduce)`: Disables all animations

### Anti-References (DO NOT DO)

- No rounded corners, no gradients, no playful elements
- No shadcn defaults, no generic SaaS dashboard look
- No emojis in the interface
- No light backgrounds anywhere
- No consumer-app feeling

---

## Environment Variables

```
NEXT_PUBLIC_CESIUM_ION_TOKEN=<cesium ion jwt token>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The Ion token enables 3D satellite globe imagery (Bing Maps aerial). Without it, fall back to CartoDB dark tiles.

---

## Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, fonts, dark theme
│   │   ├── globals.css             # All design tokens, effects, Cesium overrides
│   │   ├── page.tsx                # Globe view (/) - dynamic import GlobeView
│   │   ├── building/
│   │   │   └── page.tsx            # Building view (/building)
│   │   └── camera/
│   │       └── [id]/
│   │           └── page.tsx        # Camera view (/camera/:id)
│   ├── components/
│   │   ├── GlobeView.tsx           # CesiumJS globe + HUD + boot sequence
│   │   ├── GlobeSidebar.tsx        # Left sidebar (vision modes, building list)
│   │   ├── GlobeStatusBar.tsx      # Bottom status bar
│   │   ├── BuildingView.tsx        # Floor plan + camera placement
│   │   ├── CameraView.tsx          # Three.js Gaussian splat viewer
│   │   ├── FNAFSwitcher.tsx        # Camera thumbnail strip
│   │   ├── SimulationPrompt.tsx    # Chat input for scenarios
│   │   ├── VideoOverlay.tsx        # Full-screen video playback
│   │   └── CoverageBadge.tsx       # Coverage score circular indicator
│   ├── lib/
│   │   ├── api.ts                  # API client (with mock fallback)
│   │   ├── mock-api.ts             # Mock data when backend offline
│   │   ├── session.ts              # localStorage session + building management
│   │   ├── buildings.ts            # Pre-loaded Purdue building data
│   │   └── types.ts                # All TypeScript interfaces
│   └── types/
│       ├── gaussian-splats-3d.d.ts # Type declarations
│       └── modules.d.ts            # Module declarations
├── public/
│   ├── cesium/                     # Cesium static assets (auto-copied)
│   └── splats/                     # .splat files for buildings
├── scripts/
│   └── copy-cesium.js              # Copies Cesium assets to public/
├── .env.local                      # Environment variables
├── next.config.ts                  # Webpack config for Cesium
├── package.json
└── tsconfig.json
```

---

## Data Types (from types.ts)

```typescript
interface Position { x: number; y: number; z: number; }
interface Rotation { yaw: number; pitch: number; } // degrees
interface Camera {
  id: string;
  building_id: string;
  position: Position;
  rotation: Rotation;
  fov: number;              // field of view in degrees
  coverage_radius: number;  // meters
  placement_score: number;  // 0.0-1.0
}
interface Building {
  id: string;               // e.g. "purdue-lawson"
  name: string;
  lat: number;
  lng: number;
  footprint_polygon: Array<[number, number]>; // [[lat, lng], ...]
  splat_asset: string;      // e.g. "lawson.splat"
}
interface Simulation {
  camera_id: string;
  status: "pending" | "generating" | "complete" | "failed";
  prompt: string;
  video_url: string | null;
  error?: string;
}
```

---

## Pre-Loaded Buildings

| ID | Name | Lat | Lng | Splat |
|----|------|-----|-----|-------|
| purdue-lawson | Lawson Computer Science Building | 40.4278 | -86.9170 | lawson.splat |
| purdue-pmu | Purdue Memorial Union | 40.4247 | -86.9106 | pmu.splat |
| purdue-armstrong | Neil Armstrong Hall of Engineering | 40.4314 | -86.9193 | armstrong.splat |

Each has a realistic footprint polygon (L-shape for Lawson, complex for PMU, rectangle for Armstrong).

---

## API Endpoints (FastAPI backend at port 8000)

All paths use `/session` (SINGULAR, not /sessions).

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /session | {} | { session_id } |
| DELETE | /session/{id} | - | { ok: true } |
| POST | /session/{id}/building | { building_id, name, lat, lng, footprint_polygon } | { building } |
| GET | /session/{id}/building | - | { building } |
| POST | /session/{id}/cameras/place | { camera_count } | { cameras, coverage_score, placement_complete } |
| GET | /session/{id}/cameras | - | { cameras, placement_complete } |
| GET | /session/{id}/cameras/{cam_id} | - | { camera } |
| POST | /session/{id}/cameras/{cam_id}/simulate | { prompt } | { simulation_id, status, camera_id, prompt } |
| GET | /session/{id}/cameras/{cam_id}/simulation | - | { status, prompt, video_url, error? } |

### Mock API Fallback

When the backend is unreachable, all API calls automatically fall back to mock-api.ts which returns realistic dummy data. This means the entire demo flow works without any backend running.

---

## View 1: Globe (/)

### Boot Sequence (Intro Overlay)

Shows on page load before the globe. Terminal-style system initialization:

```
MINORITY REPORT
by Catapult — Purdue University
─────────────────────────
[HH:MM:SS] ✓ satellite uplink established        (green)
[HH:MM:SS] ✓ terrain mesh loaded                 (green)
[HH:MM:SS] ✓ building registry synced            (green)
[HH:MM:SS] ✓ camera placement engine ready       (green)
[HH:MM:SS] ✓ gaussian splat decoder initialized  (green)
[HH:MM:SS] HUD systems initializing...           (dim gray)
[HH:MM:SS] Vision modes: STANDARD | NV | FLIR active  (cyan)
[HH:MM:SS] Connecting to surveillance feeds...   (dim gray)
[HH:MM:SS] ✓ System operational — 3 targets acquired  (green)

[ CLICK TO ENTER ]  (cyan, pulsing)
```

Lines appear one by one with 300ms delay. "CLICK TO ENTER" appears after all lines. Click anywhere dismisses with a scale+fade animation.

### Globe (after intro dismisses)

- CesiumJS viewer fills entire viewport
- If Ion token: Bing Maps satellite aerial imagery (3D globe)
- If no token: CartoDB dark tiles (flat map)
- Camera: centered on Purdue campus (40.4274, -86.9167), altitude ~1200m, pitch -75 degrees
- 3 building markers: cyan 14px dots with pulsing rings, uppercase labels in Space Mono
- Click marker OR sidebar building: creates session, sets building, stores in localStorage, navigates to /building
- Dark styling: black background, no atmosphere/sun/moon, fog disabled

### HUD Overlay (pointer-events-none, above globe)

- TOP CENTER: "TOP SECRET // SCI // MINORITY REPORT SYSTEM" in cyan monospace with glow
- TOP LEFT: Green dot + "SATELLITE LINK ACTIVE", "FEED: PURDUE UNIVERSITY", "RESOLUTION: 0.3m/px"
- TOP RIGHT: Live UTC clock in green glow, "CLASSIFICATION: EYES ONLY"
- BOTTOM CENTER: "SELECT TARGET BUILDING TO PROCEED" hint, coordinates readout (LAT/LON/ALT)
- BOTTOM RIGHT: "TARGETS: 3"
- FOUR CORNERS: L-shaped cyan border brackets

### Hover Tooltip

When hovering a building marker, show tooltip: "TARGET: {BUILDING NAME}" with coordinates and "CLICK TO SELECT"

### "Establishing Secure Link" Overlay

When a building is clicked, show centered overlay with "ESTABLISHING SECURE LINK" and cursor-blink animation while API calls complete.

### Left Sidebar (GlobeSidebar, 240px)

- SURVEILLANCE OPS header
- VISION MODES: 2x2 grid (STANDARD active, NV, FLIR, CRT). Clicking changes a CSS filter on the globe container. STANDARD=none, NV=green tint, FLIR=thermal, CRT=high contrast scanlines.
- TARGET BUILDINGS: list of 3 buildings with index, name, coordinates. Clickable (triggers building selection).
- Dark semi-transparent background, bracket corners, monospace

### Bottom Status Bar (GlobeStatusBar, 36px)

- Left: "MINORITY REPORT" in cyan glow
- Center: "3 TARGETS | 0 CAMERAS | 0 SIMULATIONS"
- Right: Green dot + "LIVE", data age counter ticking up

---

## View 2: Building (/building)

### Layout

- Full-screen dark background
- Classification banner at top: "TOP SECRET // BUILDING ANALYSIS // {BUILDING NAME}"
- HUD corner brackets (4 corners)
- Left panel: SVG floor plan
- Right panel: Camera deployment controls

### Floor Plan (SVG)

- 400x400px SVG container
- Faint cyan grid background (0.05 opacity)
- Building footprint polygon rendered in cyan stroke
- After camera placement: cyan camera pins at each position
- Camera pins: clickable, hover expands, labeled (CAM-01, CAM-02, etc.)
- Click pin: navigates to /camera/[id]

### Camera Deployment Panel

- "CAMERA BUDGET" label in cyan monospace
- Number input (1-50 range, dark styled, cyan border)
- "DEPLOY CAMERAS" button (glow-cyan-box, fills cyan on hover)
- Loading state: "OPTIMIZING PLACEMENT..." with pulse animation
- After deployment: shows camera count and coverage percentage

### Coverage Badge (CoverageBadge)

- Circular SVG arc progress indicator
- Shows percentage (e.g., "88%")
- Color: green for >=80%, yellow for 50-79%, red for <50%
- Status label: "OPTIMAL" / "PARTIAL" / "INSUFFICIENT"

### Back Navigation

- "BACK TO GLOBE" button in top-left

---

## View 3: Camera (/camera/[id])

### 3D Gaussian Splat Viewer (main area)

- Three.js + @mkkellogg/gaussian-splats-3d
- Loads .splat file from /splats/{building.splat_asset}
- Camera positioned at selected camera's position {x,y,z} and rotation {yaw,pitch}
- Scene created ONCE, camera position updates on switch (no WebGL teardown)
- Fallback: "FEED UNAVAILABLE" with grid/noise pattern if .splat fails to load

### HUD Overlay

- TOP CENTER: "SURVEILLANCE FEED // EYES ONLY // {BUILDING NAME}"
- TOP LEFT: "CAM-{id}" identifier, blinking red REC indicator with timestamp
- TOP RIGHT: Position coordinates (X,Y,Z), rotation (YAW, PITCH), FOV readout
- FOUR CORNERS: Cyan bracket decorations

### FNAF Camera Switcher (FNAFSwitcher, bottom strip)

- Fixed at bottom of screen
- "FEED SELECT" label on left
- Horizontal strip of camera thumbnails
- Active camera: cyan border + glow, "ACTIVE" label
- Inactive: dim border, "STANDBY" label
- Labels: zero-padded "CAM-01", "CAM-02", etc.
- Click switches camera POV without page reload (updates Three.js camera position)

### Simulation Prompt (SimulationPrompt, above FNAF strip)

- Chat-style dark input bar
- Terminal ">" prefix
- Placeholder: "DESCRIBE SCENARIO..."
- "SIMULATE" submit button (glow-cyan on hover)
- On submit: calls POST simulate, polls GET simulation every 2s
- Loading: "GENERATING SIMULATION..." with pulse animation

### Video Overlay (VideoOverlay)

- Full-screen overlay with framer-motion entrance/exit
- "TOP SECRET // SIMULATION OUTPUT // DO NOT DISTRIBUTE" banner
- HTML5 video player with autoplay
- Click outside or press Escape to close
- Returns to splat view on close

### Back Navigation

- "BACK TO BUILDING" button in top-left

---

## View Transitions

All transitions use framer-motion:
- Enter: opacity 0, scale 0.95 → opacity 1, scale 1
- Exit: opacity 0, scale 1.05
- Duration: 0.5s, easing: cubic-bezier(0.16, 1, 0.3, 1)
- Creates "drilling down" effect going forward, "zooming out" going back

---

## User Flow (Happy Path)

1. Page loads → boot sequence plays (3s)
2. User clicks "[ CLICK TO ENTER ]" → globe reveals with satellite imagery
3. User clicks building marker on globe OR building name in sidebar
4. "ESTABLISHING SECURE LINK" overlay → navigates to /building
5. Building View shows floor plan + "CAMERA BUDGET" input
6. User enters camera count (e.g., 5) → clicks "DEPLOY CAMERAS"
7. "OPTIMIZING PLACEMENT..." → camera pins appear on floor plan, coverage badge shows 88%
8. User clicks a camera pin → navigates to /camera/[id]
9. Camera View loads Gaussian splat 3D scene at that camera's POV
10. FNAF strip at bottom shows all cameras, user can switch between them
11. User types scenario in prompt → "SIMULATE" → "GENERATING SIMULATION..."
12. Video overlay plays the generated simulation
13. User closes overlay → back to splat view

---

## Known Issues to Fix

1. **Vision mode buttons do nothing.** Need CSS filter effects: NV = `filter: saturate(0) brightness(0.8) hue-rotate(90deg)`, FLIR = `filter: sepia(1) saturate(2) brightness(0.6)`, CRT = `filter: grayscale(1) contrast(1.5)`
2. **Building View doesn't show which building.** The classification banner should include the building name.
3. **Boot screen has too much empty space.** Content is centered but only uses 30% of screen height. Consider left-aligning like a real terminal or adding background elements.
4. **Sidebar building items lack hover feedback.** Need hover:bg-cyan/5, cursor-pointer, border highlight.
5. **Bottom status bar counts are static.** "0 CAMERAS | 0 SIMULATIONS" never updates.
6. **Next.js "N" badge visible.** Should be hidden for demo.
7. **No .splat files exist yet.** Camera View always shows "FEED UNAVAILABLE" fallback.
8. **.env.local has the Cesium Ion token.** DO NOT commit this file to git.

---

## Accessibility

- All interactive elements have focus-visible outlines (2px cyan, 2px offset)
- SVG camera pins have tabIndex={0}, onKeyDown (Enter/Space), aria-labels
- SimulationPrompt input has aria-label
- FNAF buttons have aria-labels with active/standby state
- @media (prefers-reduced-motion: reduce) disables all animations

---

## Git Workflow

- Branch: main only
- Commits: present tense, e.g., "Add camera placement visualization"
- Push directly to main, no PRs
- .env.local is gitignored (contains Cesium token)

---

## How to Run

```bash
cd frontend
npm install          # Also runs copy-cesium postinstall
npm run dev          # Starts at http://localhost:3000
```

Requires Node.js 18+. The dev server uses webpack mode (not turbopack) for Cesium compatibility.
