"""
floorplan.py — Floorplan image processing

Converts a blueprint JPG into:
  - floor_mask: binary numpy array, True = walkable floor
  - wall_mask:  binary numpy array, True = wall/obstacle
  - candidate camera positions (pixel coords)
"""

from __future__ import annotations
import dataclasses
from typing import List, Tuple

import cv2
import numpy as np
from scipy import ndimage


# ---------------------------------------------------------------------------
# Public constants (override via FloorplanConfig)
# ---------------------------------------------------------------------------
PIXELS_PER_METER = 29.5   # 1px ≈ 0.034m at 1/8" blueprint scale, 72 DPI
GRID_STEP = 12             # coverage-grid resolution in pixels (~0.4 m)
CAMERA_HEIGHT_M = 2.5      # wall-mounted height in metres
CANDIDATE_WALL_STEP = 20   # subsample wall-adjacent candidates every N px
MIN_ROOM_AREA_PX = 500     # ignore connected components smaller than this


@dataclasses.dataclass
class FloorplanData:
    img: np.ndarray          # original BGR image
    floor_mask: np.ndarray   # bool H×W
    wall_mask: np.ndarray    # bool H×W
    px_per_meter: float
    grid_points: np.ndarray  # (N,2) int array of (row,col) grid sample points
    candidates: np.ndarray   # (M,2) int array of (row,col) camera candidates
    ceiling: bool = False    # True = ceiling-mounted cameras (interior floor grid)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def load_floorplan(path: str, px_per_meter: float = PIXELS_PER_METER,
                   grid_step: int = GRID_STEP,
                   wall_step: int = CANDIDATE_WALL_STEP,
                   ceiling: bool = False) -> FloorplanData:
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot open image: {path}")

    wall_mask = _detect_walls(img)
    floor_mask = _extract_floor(wall_mask, img)
    candidates = extract_candidates(floor_mask, wall_mask, step=wall_step,
                                    ceiling=ceiling)
    grid_pts = _sample_grid(floor_mask, grid_step)

    mode_str = "ceiling" if ceiling else "wall-adjacent"
    print(f"  Floor pixels: {floor_mask.sum():,}")
    print(f"  Grid points:  {len(grid_pts):,}  (step={grid_step}px)")
    print(f"  Candidates:   {len(candidates):,}  ({mode_str})")

    return FloorplanData(
        img=img,
        floor_mask=floor_mask,
        wall_mask=wall_mask,
        px_per_meter=px_per_meter,
        grid_points=grid_pts,
        candidates=candidates,
        ceiling=ceiling,
    )


# ---------------------------------------------------------------------------
# Wall detection
# ---------------------------------------------------------------------------

def _find_wall_threshold(grey: np.ndarray) -> int:
    """
    Automatically find the grey threshold that separates wall ink from floor.

    Two image types:

    Blueprint (e.g. Lawson): lowest histogram peak is at ~172+ (walls form a
      broad dark tail with no distinct lower peak). Otsu works correctly.

    Printed plan with coloured fills (e.g. dsai_3): distinct peak at ~100–150
      representing room fill colour, with dark wall ink living below that peak.
      Otsu incorrectly captures fills as walls. Instead, threshold just below
      the fill peak (at 85% of its grey value) to capture only the dark ink.
    """
    from scipy.signal import find_peaks

    hist = cv2.calcHist([grey], [0], None, [256], [0, 256]).flatten()
    smoothed = np.convolve(hist, np.ones(3) / 3, mode='same')

    # Find significant peaks (≥ 1% of tallest peak, minimum 8 grey-values apart)
    peaks, _ = find_peaks(smoothed, height=smoothed.max() * 0.01, distance=8)

    # Look at peaks below the white-floor region (< 220)
    dark_med_peaks = peaks[peaks < 220]

    if len(dark_med_peaks) > 0:
        lowest_peak = int(dark_med_peaks[0])

        if lowest_peak < 150:
            # Distinct fill peak detected (coloured room fills, e.g. dsai_3).
            # The fills live at ~lowest_peak grey; wall ink lives well below.
            # Use the grey value just below the fill peak as the threshold:
            # 90% of the fill peak captures ink + anti-aliased edges without
            # pulling in the fills themselves.
            threshold = max(40, int(lowest_peak * 0.90))
            return threshold

    # No distinct fill cluster — use Otsu (handles blueprints correctly)
    thresh_val, _ = cv2.threshold(grey, 0, 255,
                                  cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return int(thresh_val)


def _detect_walls(img: np.ndarray) -> np.ndarray:
    """
    Returns a bool mask where True = wall/obstacle.

    Strategy:
      1. Greyscale + adaptive threshold (Otsu for blueprints; valley-based for
         printed plans with coloured room fills — avoids classifying fills as walls)
      2. Morphological closing fills hairline JPEG-compression gaps
      3. Remove isolated text-label blobs: wall network is one large connected
         structure; text labels are tiny isolated components
    """
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    thresh_val = _find_wall_threshold(grey)
    print(f"  Wall threshold: {thresh_val} (grey < {thresh_val} = wall)")
    wall_raw = (grey < thresh_val).astype(np.uint8)

    # Close hairline JPEG-compression gaps along wall edges.
    # Use a 5×5 kernel — printed/scanned plans at lower thresholds may have
    # wider anti-aliasing gaps than clean blueprint files.
    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    wall_closed = cv2.morphologyEx(wall_raw, cv2.MORPH_CLOSE, close_kernel)

    # Drop isolated text-label blobs.
    # Real wall segments are large; room-number/name blobs are tiny.
    # Keep any component >= 0.1% of total image pixels.
    total_px = img.shape[0] * img.shape[1]
    min_wall_px = max(500, int(total_px * 0.001))

    labeled_wall, n_wall = ndimage.label(wall_closed)
    if n_wall > 0:
        sizes = ndimage.sum(wall_closed, labeled_wall, range(1, n_wall + 1))
        wall_clean = np.zeros_like(wall_closed)
        for lbl in range(1, n_wall + 1):
            if sizes[lbl - 1] >= min_wall_px:
                wall_clean[labeled_wall == lbl] = 1
    else:
        wall_clean = wall_closed

    return wall_clean.astype(bool)


# ---------------------------------------------------------------------------
# Floor extraction
# ---------------------------------------------------------------------------

def _extract_floor(wall_mask: np.ndarray, img: np.ndarray) -> np.ndarray:
    """
    Extract interior walkable floor, excluding the building exterior.

    Steps:
      1. non_wall = ~wall_mask  (candidate floor pixels)
      2. Flood-fill the exterior: pad non_wall with a 1-px border of "floor",
         flood-fill from (0,0) of the padded image — this reaches every
         non-wall region connected to the image edge (i.e. the exterior margin).
         Remove the padding; the filled area is the exterior.
      3. floor_raw = non_wall AND NOT exterior
      4. Keep only components >= MIN_ROOM_AREA_PX (drops noise/artefacts)
    """
    h, w = wall_mask.shape
    non_wall = (~wall_mask).astype(np.uint8)

    # --- Exterior flood-fill via padded border trick ---
    # Add 1-px border of 1s so corner (0,0) is always reachable non-wall
    padded = np.pad(non_wall, 1, mode='constant', constant_values=1)
    h_p, w_p = padded.shape
    ff_mask = np.zeros((h_p + 2, w_p + 2), dtype=np.uint8)
    cv2.floodFill(padded, ff_mask, (0, 0), 2)          # exterior pixels → 2
    exterior = (padded[1:-1, 1:-1] == 2)               # strip padding

    # Interior floor = non-wall pixels not reachable from the image edge
    floor_raw = non_wall.astype(bool) & ~exterior

    # --- Keep only meaningful floor regions ---
    labeled, n_labels = ndimage.label(floor_raw)
    if n_labels == 0:
        raise RuntimeError("No interior floor found — check wall detection")

    sizes = ndimage.sum(floor_raw, labeled, range(1, n_labels + 1))
    floor_main = np.zeros((h, w), dtype=bool)
    for lbl in range(1, n_labels + 1):
        if sizes[lbl - 1] >= MIN_ROOM_AREA_PX:
            floor_main |= (labeled == lbl)

    return floor_main


# ---------------------------------------------------------------------------
# Candidate position generation
# ---------------------------------------------------------------------------

def extract_candidates(floor_mask: np.ndarray, wall_mask: np.ndarray,
                       step: int = CANDIDATE_WALL_STEP,
                       ceiling: bool = False) -> np.ndarray:
    """
    Returns (M, 2) array of (row, col) candidate camera positions.

    Wall mode (default): floor pixels strictly 1px adjacent to a wall pixel.
    Ceiling mode (--ceiling): any interior floor pixel on a regular grid at
    `step`-pixel spacing — cameras can be mounted anywhere on the ceiling.
    """
    h, w = floor_mask.shape

    if ceiling:
        # Sample interior floor points on a regular grid — no wall adjacency
        # required.  Use the same step as the wall-step parameter.
        rs = np.arange(0, h, step)
        cs = np.arange(0, w, step)
        rr, cc = np.meshgrid(rs, cs, indexing='ij')
        mask = floor_mask[rr, cc]
        rows = rr[mask].flatten()
        cols = cc[mask].flatten()
    else:
        # Dilate walls by exactly 1 pixel (3×3 kernel) to get the floor strip
        # immediately touching the wall surface.
        dil_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        wall_dilated = cv2.dilate(wall_mask.astype(np.uint8), dil_kernel).astype(bool)
        wall_adjacent = wall_dilated & floor_mask

        rows, cols = np.where(wall_adjacent)
        idx = np.arange(0, len(rows), step)
        rows = rows[idx]
        cols = cols[idx]

    candidates: List[Tuple[int, int]] = []
    for r, c in zip(rows, cols):
        candidates.append((int(r), int(c)))

    # Deduplicate and clip to image bounds
    seen = set()
    unique: List[Tuple[int, int]] = []
    for r, c in candidates:
        r = int(np.clip(r, 0, h - 1))
        c = int(np.clip(c, 0, w - 1))
        if (r, c) not in seen and floor_mask[r, c]:
            seen.add((r, c))
            unique.append((r, c))

    return np.array(unique, dtype=np.int32)


# ---------------------------------------------------------------------------
# Coverage grid sampling
# ---------------------------------------------------------------------------

def _sample_grid(floor_mask: np.ndarray, step: int) -> np.ndarray:
    """Sample floor pixels on a regular grid. Returns (N, 2) int array (row, col)."""
    h, w = floor_mask.shape
    rs = np.arange(0, h, step)
    cs = np.arange(0, w, step)
    rr, cc = np.meshgrid(rs, cs, indexing='ij')
    mask = floor_mask[rr, cc]
    pts = np.stack([rr[mask], cc[mask]], axis=1)
    return pts.astype(np.int32)
