# Camera Placement Algorithm

Automatically places security cameras on a building floorplan image to maximize coverage. Takes a JPG/PNG blueprint, outputs camera positions/orientations as JSON and an annotated visualization PNG.

## How it works

The pipeline runs in four stages:

```
Floorplan image
      │
      ▼
[1] floorplan.py  — Detect walls, extract walkable floor, generate candidate positions
      │
      ▼
[2] visibility.py — Ray-cast from each candidate to compute FOV coverage sets
      │
      ▼
[3] optimizer.py  — Greedy set-cover + optional OR-Tools ILP to select cameras
      │
      ▼
[4] output.py     — Emit JSON (API-compatible) + annotated PNG visualization
```

### Stage 1 — Floorplan processing (`floorplan.py`)

Reads the input image and produces three data structures:

- **`wall_mask`** — binary mask of wall/obstacle pixels. Uses an adaptive thresholding strategy: Otsu for clean blueprints, a histogram valley-based threshold for printed plans with coloured room fills. Small isolated blobs (text labels) are dropped.
- **`floor_mask`** — interior walkable pixels only. Determined by flood-filling from the image edge to identify exterior space, then inverting.
- **`candidates`** — wall-adjacent camera positions (pixels 1px inside a wall). Subsampled every `--wall-step` pixels. These are the only locations cameras can be placed.
- **`grid_points`** — regular grid of floor pixels at `--grid-step` spacing, used as coverage measurement points.

### Stage 2 — Visibility computation (`visibility.py`)

For each candidate position:

1. Cast `--n-rays` rays (default 360, one per degree) in all directions until hitting a wall or reaching max range.
2. Find the best yaw: slide a `--fov`-wide window over the 360° ray-length array to find the direction maximising total visible distance.
3. Build a **coverage set**: the subset of grid points that fall within the FOV cone, are within range, and aren't occluded by a wall (checked by comparing point distance against the ray length in that direction).

### Stage 3 — Optimization (`optimizer.py`)

Two modes:

**Budget mode** (`--camera-count N`): Greedy set-cover — iteratively pick the camera that covers the most currently uncovered grid points, repeat N times.

**Auto-minimize mode** (default): Find the fewest cameras needed to hit `--coverage-target` (default 98%).
1. Run greedy until target is met.
2. If greedy selected ≤ 50 cameras, run OR-Tools CP-SAT ILP for the provably optimal (minimum) solution within `--ilp-timeout` seconds. Falls back to greedy if ILP times out.

### Stage 4 — Output (`output.py`)

- **JSON** — Camera list matching the API's `Camera` interface. Pixel coordinates are converted to world metres centred on the building, with yaw in compass degrees (0°=North).
- **PNG** — Annotated floorplan with FOV wedges per camera (each in a unique colour), uncovered floor highlighted in red, and a coverage percentage title.

## Usage

```bash
python main.py <floorplan.jpg> [options]
```

**Examples:**

```bash
# Auto-minimize cameras to cover 98% of floor
python main.py lawson_1.JPG

# Fixed budget of 20 cameras, skip ILP
python main.py lawson_1.JPG --camera-count 20 --no-ilp

# 99% target, 12m max camera range
python main.py lawson_1.JPG --coverage-target 0.99 --max-range 12

# Custom scale (pixels per metre)
python main.py blueprint.png --scale 40.0
```

**All options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--camera-count N` | auto | Fix number of cameras (greedy only) |
| `--coverage-target F` | `0.98` | Target coverage fraction in auto mode |
| `--scale F` | `29.5` | Pixels per metre (1/8" scale at 72 DPI) |
| `--max-range F` | infinite | Camera max range in metres |
| `--fov F` | `90.0` | Camera field of view in degrees |
| `--no-ilp` | off | Skip ILP, use greedy only |
| `--grid-step N` | `12` | Coverage grid resolution in pixels |
| `--wall-step N` | `10` | Candidate subsampling step in pixels |
| `--n-rays N` | `360` | Angular resolution for ray casting |
| `--building-id STR` | `purdue-lawson` | Building ID in JSON output |
| `--output-dir DIR` | `./output` | Output directory |

## Output

Both files are written to `--output-dir` with a timestamp stem:

```
output/
  cameras_20260404_035914.json   # camera positions + metadata
  cameras_20260404_035914.png    # annotated floorplan
```

**JSON schema:**
```json
{
  "building_id": "purdue-lawson",
  "coverage_score": 0.983,
  "camera_count": 12,
  "cameras": [
    {
      "id": "cam_1",
      "building_id": "purdue-lawson",
      "position": { "x": 4.237, "y": 2.5, "z": -1.102 },
      "rotation": { "yaw": 270.0, "pitch": -20.0 },
      "fov": 90.0,
      "coverage_radius": 8.45,
      "placement_score": 0.0812
    }
  ]
}
```

Position is in metres from building centre (`x`=east, `z`=north, `y`=wall height fixed at 2.5m). Yaw is compass degrees (0°=North, 90°=East). `placement_score` is the fraction of total floor covered uniquely by this camera.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Dependencies: `numpy`, `opencv-python`, `scipy`, `matplotlib`, `ortools`, `Pillow`, `scikit-image`.

OR-Tools is optional — if not installed, ILP is skipped and greedy is used.

## Files

| File | Purpose |
|------|---------|
| `main.py` | CLI entry point, orchestrates the 4-stage pipeline |
| `floorplan.py` | Image processing — wall detection, floor extraction, candidate generation |
| `visibility.py` | Ray-casting and FOV coverage set computation |
| `optimizer.py` | Greedy set-cover and OR-Tools ILP optimization |
| `output.py` | JSON serialization and PNG visualization |
