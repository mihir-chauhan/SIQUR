"""
visibility.py — 2D ray-casting visibility for candidate camera positions

For each candidate position:
  - Cast N_RAYS rays in 360° to find the visibility polygon
  - Find the optimal 90° FOV cone direction (best yaw)
  - Compute which coverage-grid points fall inside that cone

Output: VisibilityData with per-candidate coverage bitmasks
"""

from __future__ import annotations
import dataclasses
from typing import List

import numpy as np

from floorplan import FloorplanData


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
N_RAYS = 360          # angular resolution (1° steps)
FOV_DEG = 90.0        # camera field of view


@dataclasses.dataclass
class VisibilityData:
    # Per-candidate data (indexed in same order as FloorplanData.candidates)
    ray_lengths: np.ndarray      # (M, N_RAYS) float32 — ray length to wall in px
    best_yaw_idx: np.ndarray     # (M,) int — index into 0..N_RAYS-1 of FOV centre
    coverage_sets: List[np.ndarray]  # M × (K_i,) int arrays — grid-point indices covered

    grid_points: np.ndarray      # (N, 2) same ref as FloorplanData.grid_points
    n_grid: int                  # total grid points


def compute_visibility(fp: FloorplanData,
                       fov_deg: float = FOV_DEG,
                       max_range_m: float = 15.0,
                       n_rays: int = N_RAYS,
                       batch_size: int = 64) -> VisibilityData:
    """
    Main entry point. Computes visibility for all candidates in fp.

    Args:
        fp:          FloorplanData from floorplan.py
        fov_deg:     Camera field of view in degrees
        max_range_m: Maximum camera range in metres
        n_rays:      Number of rays cast per candidate (angular resolution)
        batch_size:  Candidates processed per numpy batch (memory control)

    Returns:
        VisibilityData
    """
    wall_mask = fp.wall_mask
    candidates = fp.candidates   # (M, 2) int (row, col)
    grid_pts = fp.grid_points    # (N, 2) int (row, col)
    px_per_m = fp.px_per_meter
    max_range_px = max_range_m * px_per_m

    M = len(candidates)
    N = len(grid_pts)
    half_fov = int(round(fov_deg / 2))  # in ray-index units (1 ray = 1°)

    # Pre-compute ray unit vectors
    angles = np.linspace(0, 2 * np.pi, n_rays, endpoint=False)  # (n_rays,)
    dx = np.cos(angles).astype(np.float32)   # column direction
    dy = np.sin(angles).astype(np.float32)   # row direction (positive = down)

    h, w = wall_mask.shape
    wall_u8 = wall_mask.astype(np.uint8)

    # Determine step count from max range
    n_steps = int(max_range_px) + 1

    # Pre-compute step offsets: shape (n_steps, n_rays)
    t = np.arange(1, n_steps + 1, dtype=np.float32)  # (n_steps,)
    step_dc = np.outer(t, dx)  # (n_steps, n_rays)  column offsets
    step_dr = np.outer(t, dy)  # (n_steps, n_rays)  row offsets

    # Results
    all_ray_lengths = np.zeros((M, n_rays), dtype=np.float32)
    all_best_yaw = np.zeros(M, dtype=np.int32)
    all_coverage: List[np.ndarray] = []

    # Pre-compute grid point coords for fast cone-inclusion test
    gp_row = grid_pts[:, 0].astype(np.float32)  # (N,)
    gp_col = grid_pts[:, 1].astype(np.float32)  # (N,)

    print(f"  Ray-casting {M} candidates ({n_rays} rays, {n_steps} steps each)...")

    for start in range(0, M, batch_size):
        end = min(start + batch_size, M)
        batch = candidates[start:end]  # (B, 2)
        B = len(batch)

        cam_row = batch[:, 0].astype(np.float32)  # (B,)
        cam_col = batch[:, 1].astype(np.float32)  # (B,)

        # For each candidate, cast all rays
        # sample_r[step, ray] → row positions for a single candidate; we loop candidates
        # to avoid memory explosion (B × n_steps × n_rays could be huge)
        ray_lens = np.full((B, n_rays), max_range_px, dtype=np.float32)

        for bi in range(B):
            # sample positions: (n_steps, n_rays)
            sr = (cam_row[bi] + step_dr).astype(np.int32)
            sc = (cam_col[bi] + step_dc).astype(np.int32)

            # Clip to image bounds
            np.clip(sr, 0, h - 1, out=sr)
            np.clip(sc, 0, w - 1, out=sc)

            # Wall hits: wall_u8[sr, sc]  shape (n_steps, n_rays)
            hits = wall_u8[sr, sc]  # (n_steps, n_rays)

            # For each ray, find first hit step (argmax on True)
            # If no hit, ray goes to max_range
            hit_any = hits.any(axis=0)  # (n_rays,)
            first_hit = np.argmax(hits, axis=0).astype(np.float32)  # (n_rays,)
            # argmax returns 0 when no hit — correct with hit_any mask
            ray_lens[bi] = np.where(hit_any, first_hit + 1.0, max_range_px)

        all_ray_lengths[start:end] = ray_lens

        # Best yaw: maximize sum of ray lengths over FOV window (sliding window)
        for bi in range(B):
            ci = start + bi
            rl = ray_lens[bi]  # (n_rays,)

            # Wrap-around convolution for circular sliding window
            fov_half_rays = int(round(fov_deg / (360.0 / n_rays) / 2))
            window = int(round(fov_deg / (360.0 / n_rays)))
            rl_tiled = np.concatenate([rl, rl])  # tile for wrap-around
            conv = np.convolve(rl_tiled, np.ones(window, dtype=np.float32), 'valid')
            best_yaw_idx = int(np.argmax(conv[:n_rays]))
            all_best_yaw[ci] = best_yaw_idx

            # Compute coverage set: grid points in FOV cone AND visible AND in range
            cone_covered = _compute_cone_coverage(
                cam_row=float(candidates[ci, 0]),
                cam_col=float(candidates[ci, 1]),
                best_yaw_idx=best_yaw_idx,
                ray_lengths=rl,
                gp_row=gp_row,
                gp_col=gp_col,
                n_rays=n_rays,
                fov_deg=fov_deg,
                max_range_px=max_range_px,
                wall_u8=wall_u8,
            )
            all_coverage.append(cone_covered)

        if (start // batch_size) % 5 == 0:
            pct = 100 * end / M
            print(f"    {end}/{M} ({pct:.0f}%)", end='\r', flush=True)

    print(f"    {M}/{M} (100%)     ")

    return VisibilityData(
        ray_lengths=all_ray_lengths,
        best_yaw_idx=all_best_yaw,
        coverage_sets=all_coverage,
        grid_points=grid_pts,
        n_grid=len(grid_pts),
    )


def _compute_cone_coverage(
    cam_row: float, cam_col: float,
    best_yaw_idx: int,
    ray_lengths: np.ndarray,
    gp_row: np.ndarray, gp_col: np.ndarray,
    n_rays: int, fov_deg: float, max_range_px: float,
    wall_u8: np.ndarray,
) -> np.ndarray:
    """
    Returns indices into grid_points that are covered by this camera.

    Fast vectorized approach:
      - For each grid point, look up the ray in the closest angular direction
      - A point is visible if its distance < ray_length in that direction
      - This avoids per-point ray marching (O(N) vs O(N*D))

    A grid point p is covered if:
      1. It falls within the FOV cone centred on best_yaw
      2. Its distance from camera < ray_length at that angle (wall-aware)
    """
    # Vector from camera to each grid point
    dr = gp_row - cam_row   # (N,) row delta (positive = down)
    dc = gp_col - cam_col   # (N,) col delta (positive = right)
    dist = np.sqrt(dr ** 2 + dc ** 2)  # (N,)

    # Range check
    in_range = dist <= max_range_px

    # Angle of each grid point in radians
    angle_to_pt = np.arctan2(dr, dc)  # (N,) in [-pi, pi]
    # Convert to ray index [0, n_rays)
    ray_angle_step = 2 * np.pi / n_rays
    ray_idx_float = angle_to_pt / ray_angle_step
    ray_idx_arr = (np.round(ray_idx_float).astype(np.int32) % n_rays)

    # FOV cone check: angular distance from best_yaw_idx
    angle_diff_idx = (ray_idx_arr - best_yaw_idx + n_rays // 2) % n_rays - n_rays // 2
    half_fov_rays = int(round(fov_deg / (360.0 / n_rays) / 2))
    in_cone = np.abs(angle_diff_idx) <= half_fov_rays

    # Visibility check: point distance vs ray length in that direction
    max_dist_for_pt = ray_lengths[ray_idx_arr]  # (N,) lookup from ray table
    is_visible = dist < max_dist_for_pt

    covered = in_range & in_cone & is_visible
    return np.where(covered)[0].astype(np.int32)
