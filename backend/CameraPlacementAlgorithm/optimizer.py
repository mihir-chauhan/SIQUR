"""
optimizer.py — Set-cover optimization for camera placement

Two phases:
  1. Greedy set cover (fast, ~log-optimal approximation)
  2. OR-Tools CP-SAT ILP (exact minimum, optional)

Returns list of selected candidate indices.
"""

from __future__ import annotations
from typing import List, Optional, Set
import time

import numpy as np

from visibility import VisibilityData


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def optimize(vis: VisibilityData,
             camera_count: Optional[int] = None,
             coverage_target: float = 0.98,
             use_ilp: bool = True,
             ilp_timeout_sec: float = 15.0) -> List[int]:
    """
    Returns sorted list of selected candidate indices.

    Args:
        vis:              VisibilityData from visibility.py
        camera_count:     If set, select exactly this many cameras (greedy).
        coverage_target:  If camera_count is None, cover this fraction of floor.
        use_ilp:          If True and camera_count is None, run ILP after greedy.
        ilp_timeout_sec:  Hard timeout for ILP solver.
    """
    n_grid = vis.n_grid
    coverage_sets = vis.coverage_sets  # List of (K_i,) int arrays

    if camera_count is not None:
        selected = _greedy_budget(coverage_sets, n_grid, budget=camera_count)
        cov = _coverage_fraction(selected, coverage_sets, n_grid)
        print(f"  Greedy ({camera_count} cameras): {cov:.1%} coverage")
        return selected

    # Auto-minimize mode
    greedy_selected = _greedy_target(coverage_sets, n_grid, target=coverage_target)
    cov = _coverage_fraction(greedy_selected, coverage_sets, n_grid)
    print(f"  Greedy: {len(greedy_selected)} cameras → {cov:.1%} coverage")

    if not use_ilp:
        return greedy_selected

    if len(greedy_selected) > 50:
        print(f"  Skipping ILP (greedy gave {len(greedy_selected)} cameras, too many)")
        return greedy_selected

    print(f"  Running ILP (timeout={ilp_timeout_sec:.0f}s)...")
    t0 = time.time()
    ilp_selected = _ilp_set_cover(coverage_sets, n_grid,
                                   coverage_target=coverage_target,
                                   timeout_sec=ilp_timeout_sec)
    elapsed = time.time() - t0

    if ilp_selected is not None:
        ilp_cov = _coverage_fraction(ilp_selected, coverage_sets, n_grid)
        print(f"  ILP:    {len(ilp_selected)} cameras → {ilp_cov:.1%} coverage "
              f"({elapsed:.1f}s)")
        if len(ilp_selected) <= len(greedy_selected):
            return ilp_selected
    else:
        print(f"  ILP timed out after {elapsed:.1f}s — using greedy result")

    return greedy_selected


# ---------------------------------------------------------------------------
# Greedy set cover
# ---------------------------------------------------------------------------

def _greedy_budget(coverage_sets: List[np.ndarray], n_grid: int,
                   budget: int) -> List[int]:
    """Select exactly `budget` cameras greedily."""
    uncovered = np.ones(n_grid, dtype=bool)
    selected: List[int] = []

    # Convert to sets of grid indices for fast intersection
    cov_sets_py: List[Set[int]] = [set(cs.tolist()) for cs in coverage_sets]
    uncovered_set: Set[int] = set(range(n_grid))

    for _ in range(budget):
        if not uncovered_set:
            break
        best_idx = max(range(len(coverage_sets)),
                       key=lambda i: len(cov_sets_py[i] & uncovered_set)
                       if i not in selected else -1)
        selected.append(best_idx)
        uncovered_set -= cov_sets_py[best_idx]

    return sorted(selected)


def _greedy_target(coverage_sets: List[np.ndarray], n_grid: int,
                   target: float) -> List[int]:
    """Select cameras greedily until coverage_target is met."""
    target_count = int(n_grid * target)
    covered_count = 0
    selected: List[int] = []
    selected_set: Set[int] = set()

    # Use numpy bitmask for speed
    covered = np.zeros(n_grid, dtype=bool)
    # Pre-build per-candidate masks
    cov_masks = []
    for cs in coverage_sets:
        m = np.zeros(n_grid, dtype=bool)
        if len(cs) > 0:
            m[cs] = True
        cov_masks.append(m)

    while covered_count < target_count and len(selected) < len(coverage_sets):
        uncovered = ~covered
        # Score: number of uncovered points each candidate covers
        best_score = -1
        best_idx = -1
        for i, mask in enumerate(cov_masks):
            if i in selected_set:
                continue
            score = int((mask & uncovered).sum())
            if score > best_score:
                best_score = score
                best_idx = i

        if best_idx == -1 or best_score == 0:
            break  # nothing more to cover

        selected.append(best_idx)
        selected_set.add(best_idx)
        new_covered = cov_masks[best_idx] & uncovered
        covered |= new_covered
        covered_count += int(new_covered.sum())

    return sorted(selected)


# ---------------------------------------------------------------------------
# OR-Tools ILP
# ---------------------------------------------------------------------------

def _ilp_set_cover(coverage_sets: List[np.ndarray], n_grid: int,
                   coverage_target: float = 0.98,
                   timeout_sec: float = 15.0) -> Optional[List[int]]:
    """
    Exact minimum set cover via OR-Tools CP-SAT.

    Returns sorted list of selected camera indices, or None if timeout.
    """
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        print("  ortools not installed — skipping ILP")
        return None

    M = len(coverage_sets)
    target_pts = int(n_grid * coverage_target)

    # Build reverse index: grid_point → list of cameras covering it
    covering: List[List[int]] = [[] for _ in range(n_grid)]
    for cam_idx, cs in enumerate(coverage_sets):
        for pt in cs:
            covering[pt].append(cam_idx)

    # Only require coverage for the most critical grid points
    # (those covered by fewer cameras are harder constraints)
    required_pts = [p for p in range(n_grid) if len(covering[p]) > 0]
    # Sort by difficulty (fewest cameras cover them first)
    required_pts.sort(key=lambda p: len(covering[p]))

    model = cp_model.CpModel()

    # Decision variables
    x = [model.new_bool_var(f'x_{i}') for i in range(M)]

    # Coverage constraints — only add for points that CAN be covered
    n_constrained = 0
    for p in required_pts:
        covers = covering[p]
        if covers:
            model.add(sum(x[i] for i in covers) >= 1)
            n_constrained += 1

    # Minimize camera count
    model.minimize(sum(x))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout_sec
    solver.parameters.num_workers = 4  # parallel search

    status = solver.solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        selected = [i for i in range(M) if solver.value(x[i])]
        return sorted(selected)

    return None


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _coverage_fraction(selected: List[int], coverage_sets: List[np.ndarray],
                        n_grid: int) -> float:
    if n_grid == 0:
        return 0.0
    covered = np.zeros(n_grid, dtype=bool)
    for i in selected:
        if len(coverage_sets[i]) > 0:
            covered[coverage_sets[i]] = True
    return float(covered.sum()) / n_grid


def compute_placement_scores(selected: List[int],
                             coverage_sets: List[np.ndarray],
                             n_grid: int) -> List[float]:
    """
    Returns per-camera placement_score: unique contribution / total floor pts.
    """
    scores = []
    covered_before = np.zeros(n_grid, dtype=bool)

    for i in selected:
        cs = coverage_sets[i]
        if len(cs) > 0:
            new_covered = ~covered_before[cs]
            unique_count = int(new_covered.sum())
            covered_before[cs] = True
        else:
            unique_count = 0
        scores.append(unique_count / max(n_grid, 1))

    return scores


def compute_coverage_radius(selected: List[int],
                            ray_lengths: np.ndarray,
                            best_yaw_idx: np.ndarray,
                            px_per_meter: float,
                            fov_deg: float = 90.0,
                            n_rays: int = 360) -> List[float]:
    """
    Returns per-camera coverage_radius in metres:
    max ray length within the FOV cone.
    """
    radii = []
    half_fov = int(round(fov_deg / (360.0 / n_rays) / 2))

    for i in selected:
        yaw = int(best_yaw_idx[i])
        rl = ray_lengths[i]  # (n_rays,)
        # Extract FOV window (wrap-around)
        indices = [(yaw - half_fov + k) % n_rays for k in range(2 * half_fov + 1)]
        fov_lengths = rl[indices]
        max_px = float(fov_lengths.max())
        radii.append(max_px / px_per_meter)

    return radii
