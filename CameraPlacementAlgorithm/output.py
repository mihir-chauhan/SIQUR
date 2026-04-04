"""
output.py — Convert algorithm results to JSON + annotated visualization

JSON schema matches types.ts Camera interface exactly:
  {
    id, building_id,
    position: {x, y, z},   # metres from building centre (x=east, z=north, y=height)
    rotation: {yaw, pitch}, # degrees; yaw=compass (0=east,90=north), pitch=-20
    fov,
    coverage_radius,
    placement_score
  }
"""

from __future__ import annotations
import json
import math
import os
from datetime import datetime
from typing import List

import cv2
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from floorplan import FloorplanData, CAMERA_HEIGHT_M
from visibility import VisibilityData
from optimizer import compute_placement_scores, compute_coverage_radius, _coverage_fraction


# ---------------------------------------------------------------------------
# Coordinate transform
# ---------------------------------------------------------------------------

def pixel_to_world(row: float, col: float, fp: FloorplanData):
    """
    Convert image pixel (row, col) to world metres (x, y, z).

    Coordinate system (matches BuildingView.tsx cameraToSVG):
      x: east,  positive = right in image
      z: north, positive = up in image (row decreases)
      y: fixed wall height
    """
    h, w = fp.floor_mask.shape
    cx = w / 2.0
    cz = h / 2.0
    x_m = (col - cx) / fp.px_per_meter
    z_m = -(row - cz) / fp.px_per_meter   # flip row axis
    return x_m, CAMERA_HEIGHT_M, z_m


def ray_idx_to_yaw(ray_idx: int, n_rays: int = 360) -> float:
    """
    Convert ray index (0=east, 90=south in image coords) to compass yaw degrees.

    Ray angles: 0=east(+col), π/2=south(+row), π=west, 3π/2=north(-row)
    Compass yaw: 0=east, 90=north, 180=west, 270=south

    Transform: yaw = (90 - math_deg) % 360
    """
    math_deg = ray_idx * (360.0 / n_rays)
    # Image Y is flipped (row increases downward), so south in image = north in world
    # Therefore: image angle 90° (south) → world 270° (south in compass)
    # compass_yaw = (360 - math_deg + 90) % 360 ... let's do it carefully:
    # math angle 0° = east. In image, +row is down (south). arctan2(dy, dx) where
    # dy = row_direction (positive=down=south in image = south in world).
    # So math angle 90° = +row = south in world = 270° compass.
    # Compass yaw: 0=east, 90=north, 180=west, 270=south
    # math_deg → compass: compass = (90 - math_deg) % 360
    #   0 (east) → 90... wait, we want 0=east → compass 0° or 90°?
    # Let's define compass as: 0°=North, 90°=East (standard compass convention)
    # Then: math 0° (east) → compass 90°
    #       math 90° (down/south in image, but south in world) → compass 180°
    #       math 180° (west) → compass 270°
    #       math 270° (up/north in image, north in world) → compass 0°
    # compass = (90 - math_deg + 360) % 360   (standard math→compass)
    # But image row is flipped, so south in image IS south in world already.
    compass = (90.0 - math_deg) % 360.0
    return compass


# ---------------------------------------------------------------------------
# Build camera dicts
# ---------------------------------------------------------------------------

def build_cameras(selected: List[int],
                  fp: FloorplanData,
                  vis: VisibilityData,
                  building_id: str,
                  fov_deg: float = 90.0,
                  n_rays: int = 360) -> List[dict]:
    """
    Build list of Camera dicts matching types.ts Camera interface.
    """
    placement_scores = compute_placement_scores(selected, vis.coverage_sets, vis.n_grid)
    coverage_radii = compute_coverage_radius(
        selected, vis.ray_lengths, vis.best_yaw_idx,
        fp.px_per_meter, fov_deg, n_rays
    )

    cameras = []
    for rank, (cam_idx, score, radius) in enumerate(
        zip(selected, placement_scores, coverage_radii), start=1
    ):
        row, col = fp.candidates[cam_idx]
        x_m, y_m, z_m = pixel_to_world(float(row), float(col), fp)
        yaw = ray_idx_to_yaw(int(vis.best_yaw_idx[cam_idx]), n_rays)

        cameras.append({
            "id": f"cam_{rank}",
            "building_id": building_id,
            "position": {
                "x": round(x_m, 3),
                "y": round(y_m, 3),
                "z": round(z_m, 3),
            },
            "rotation": {
                "yaw": round(yaw, 1),
                "pitch": -20.0,
            },
            "fov": fov_deg,
            "coverage_radius": round(radius, 2),
            "placement_score": round(score, 4),
        })

    return cameras


# ---------------------------------------------------------------------------
# JSON output
# ---------------------------------------------------------------------------

def save_json(cameras: List[dict],
              selected: List[int],
              vis: VisibilityData,
              output_path: str,
              building_id: str) -> None:
    coverage = _coverage_fraction(selected, vis.coverage_sets, vis.n_grid)
    result = {
        "building_id": building_id,
        "coverage_score": round(coverage, 4),
        "camera_count": len(cameras),
        "cameras": cameras,
    }
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"  JSON → {output_path}")


# ---------------------------------------------------------------------------
# Visualization
# ---------------------------------------------------------------------------

def _camera_colors(n: int):
    """
    Generate n perceptually distinct RGB colours.
    Uses HSV with golden-ratio hue spacing so adjacent cameras never share
    a similar hue, even for large n.
    Returns list of (r, g, b) tuples in [0, 1].
    """
    golden = 0.6180339887  # 1/φ
    colours = []
    h = 0.05  # start slightly away from red so red is reserved for uncovered
    for _ in range(n):
        import colorsys
        r, g, b = colorsys.hsv_to_rgb(h % 1.0, 0.85, 0.95)
        colours.append((r, g, b))
        h += golden
    return colours


def save_visualization(fp: FloorplanData,
                       vis: VisibilityData,
                       selected: List[int],
                       cameras: List[dict],
                       output_path: str,
                       fov_deg: float = 90.0,
                       n_rays: int = 360) -> None:
    """
    Render annotated floorplan PNG:
      - Original image as base
      - Semi-transparent grey overlay on walkable floor (neutral base)
      - Each camera FOV wedge filled + outlined in its own unique colour
      - Camera dot in the same unique colour, black edge, numbered label
      - Semi-transparent red overlay on uncovered floor grid points
      - Legend strip at bottom mapping number → colour
    """
    h, w = fp.floor_mask.shape
    img_rgb = cv2.cvtColor(fp.img, cv2.COLOR_BGR2RGB)
    n_cams = len(selected)
    colours = _camera_colors(n_cams)

    fig, ax = plt.subplots(figsize=(w / 100, h / 100), dpi=100)
    ax.imshow(img_rgb)
    ax.axis('off')

    # --- Subtle floor tint (dark overlay so colours pop) ---
    floor_overlay = np.zeros((h, w, 4), dtype=np.float32)
    floor_overlay[fp.floor_mask, :3] = 0.0   # black tint
    floor_overlay[fp.floor_mask, 3] = 0.25
    ax.imshow(floor_overlay)

    # --- FOV wedges (drawn first so dots sit on top) ---
    angles_arr = np.linspace(0, 2 * np.pi, n_rays, endpoint=False)
    half_rays = int(round(fov_deg / (360.0 / n_rays) / 2))

    for rank, (cam_idx, colour) in enumerate(zip(selected, colours), start=1):
        row, col = fp.candidates[cam_idx]
        yaw_idx = int(vis.best_yaw_idx[cam_idx])
        rl = vis.ray_lengths[cam_idx]

        wedge_x = [col]
        wedge_y = [row]
        for k in range(-half_rays, half_rays + 1):
            idx = (yaw_idx + k) % n_rays
            ang = angles_arr[idx]
            end_c = col + np.cos(ang) * rl[idx]
            end_r = row + np.sin(ang) * rl[idx]
            wedge_x.append(end_c)
            wedge_y.append(end_r)
        wedge_x.append(col)
        wedge_y.append(row)

        ax.fill(wedge_x, wedge_y, color=colour, alpha=0.28, linewidth=0)
        ax.plot(wedge_x, wedge_y, color=colour, alpha=0.7, linewidth=0.8)

    # --- Camera dots + labels (drawn on top of wedges) ---
    for rank, (cam_idx, colour) in enumerate(zip(selected, colours), start=1):
        row, col = fp.candidates[cam_idx]

        # Dot: unique colour fill, black edge
        ax.plot(col, row, 'o', color=colour, markersize=7,
                markeredgecolor='black', markeredgewidth=0.8, zorder=6)

        # Number label: white text on a dark box tinted with the camera colour
        label_bg = (*colour, 0.85)  # RGBA
        ax.text(col + 5, row - 6, str(rank),
                color='white', fontsize=4.5, fontweight='bold', zorder=7,
                bbox=dict(boxstyle='round,pad=0.15',
                          facecolor=colour, edgecolor='none', alpha=0.85))

    # --- Uncovered floor points (red) ---
    covered_mask = np.zeros(vis.n_grid, dtype=bool)
    for i in selected:
        if len(vis.coverage_sets[i]) > 0:
            covered_mask[vis.coverage_sets[i]] = True

    gp = vis.grid_points
    uncov_pts = gp[~covered_mask]
    if len(uncov_pts) > 0:
        uncov_overlay = np.zeros((h, w, 4), dtype=np.float32)
        for r, c in uncov_pts:
            r0 = max(0, r - 3); r1 = min(h, r + 4)
            c0 = max(0, c - 3); c1 = min(w, c + 4)
            uncov_overlay[r0:r1, c0:c1, 0] = 1.0
            uncov_overlay[r0:r1, c0:c1, 3] = 0.6
        ax.imshow(uncov_overlay)

    # --- Title ---
    coverage = _coverage_fraction(selected, vis.coverage_sets, vis.n_grid)
    ax.set_title(
        f"{n_cams} cameras · {coverage:.1%} coverage",
        fontsize=11, color='white', pad=5,
        bbox=dict(facecolor='#111111', alpha=0.85, linewidth=0)
    )
    fig.patch.set_facecolor('#111111')

    plt.tight_layout(pad=0)
    plt.savefig(output_path, dpi=100, bbox_inches='tight',
                facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  PNG  → {output_path}")


# ---------------------------------------------------------------------------
# Timestamp helper
# ---------------------------------------------------------------------------

def timestamp_stem() -> str:
    return datetime.now().strftime('%Y%m%d_%H%M%S')
