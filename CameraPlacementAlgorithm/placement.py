import math
from typing import Dict, FrozenSet, List, Optional, Set, Tuple

from .geometry import (
    angle_to_point,
    angular_difference,
    compute_bounding_box,
    ensure_ccw,
    footprint_edges_as_walls,
    point_in_polygon,
    polygon_area,
    polygon_centroid,
    ray_hits_any_wall,
    _inward_normal,
)
from .models import (
    Camera,
    CameraPosition,
    CameraRotation,
    PlacementRequest,
    PlacementResult,
    Point2D,
    WallSegment,
)

_WALL_SAMPLE_SPACING = 2.0   # meters between wall-mounted candidate samples
_INSET_DISTANCE = 0.3        # meters camera is set in from the wall face
_YAW_STEP = 15.0             # degrees between yaw candidates
_DEDUP_THRESHOLD = 0.1       # candidates closer than this are merged
_PITCH = -15.0               # fixed downward tilt for all cameras
_LARGE_AREA_THRESHOLD = 5000.0  # sq units; triggers coarser grid
_GRID_SPACING_FINE = 1.0
_GRID_SPACING_COARSE = 2.0


# ---------------------------------------------------------------------------
# Step 1: Candidate camera positions
# ---------------------------------------------------------------------------

def _sample_wall_candidates(
    polygon: List[Point2D],
    centroid: Point2D,
    inset_distance: float,
    wall_sample_spacing: float,
) -> List[Point2D]:
    """
    Sample inset positions along each polygon wall edge and at each vertex.
    Returns raw candidates (may include duplicates; filtering happens in caller).
    """
    candidates: List[Point2D] = []
    n = len(polygon)

    for i in range(n):
        x1, z1 = polygon[i]
        x2, z2 = polygon[(i + 1) % n]
        edge_len = math.hypot(x2 - x1, z2 - z1)
        if edge_len < 1e-6:
            continue

        nx, nz = _inward_normal(x1, z1, x2, z2, centroid)

        # Sample along the edge
        num_samples = max(1, int(edge_len / wall_sample_spacing))
        for k in range(num_samples):
            t = (k + 0.5) / num_samples
            sx = x1 + t * (x2 - x1) + nx * inset_distance
            sz = z1 + t * (z2 - z1) + nz * inset_distance
            candidates.append((sx, sz))

        # Include inset version of each vertex
        # Use the average inward normal of the two adjacent edges
        prev_x, prev_z = polygon[(i - 1) % n]
        nx_prev, nz_prev = _inward_normal(prev_x, prev_z, x1, z1, centroid)
        avg_nx = (nx + nx_prev) / 2.0
        avg_nz = (nz + nz_prev) / 2.0
        length = math.hypot(avg_nx, avg_nz)
        if length > 1e-9:
            avg_nx /= length
            avg_nz /= length
        candidates.append((x1 + avg_nx * inset_distance, z1 + avg_nz * inset_distance))

    return candidates


def _deduplicate(candidates: List[Point2D], threshold: float) -> List[Point2D]:
    """Remove candidates within `threshold` units of an already-kept candidate."""
    kept: List[Point2D] = []
    for c in candidates:
        for k in kept:
            if math.hypot(c[0] - k[0], c[1] - k[1]) < threshold:
                break
        else:
            kept.append(c)
    return kept


def generate_candidate_positions(
    footprint: List[Point2D],
    centroid: Point2D,
    inset_distance: float = _INSET_DISTANCE,
    wall_sample_spacing: float = _WALL_SAMPLE_SPACING,
) -> List[Point2D]:
    """
    Generate candidate camera positions along interior wall faces.
    All returned positions are guaranteed to be inside the footprint.
    """
    raw = _sample_wall_candidates(footprint, centroid, inset_distance, wall_sample_spacing)
    inside = [p for p in raw if point_in_polygon(p, footprint)]

    if not inside:
        # Fallback: use raw polygon vertices (no inset)
        inside = [p for p in footprint if point_in_polygon(p, footprint)]
        # If vertices are on the boundary (they usually are), shift slightly toward centroid
        shifted = []
        for p in footprint:
            dx = centroid[0] - p[0]
            dz = centroid[1] - p[1]
            dist = math.hypot(dx, dz)
            if dist > 1e-9:
                shifted.append((p[0] + dx / dist * 0.05, p[1] + dz / dist * 0.05))
        inside = [p for p in shifted if point_in_polygon(p, footprint)]

    return _deduplicate(inside, _DEDUP_THRESHOLD)


# ---------------------------------------------------------------------------
# Step 2: Coverage grid
# ---------------------------------------------------------------------------

def build_coverage_grid(
    footprint: List[Point2D],
    grid_spacing: Optional[float] = None,
) -> List[Point2D]:
    """
    Uniform interior grid. Auto-scales spacing for large buildings.
    """
    area = abs(polygon_area(footprint))
    if grid_spacing is None:
        grid_spacing = _GRID_SPACING_COARSE if area > _LARGE_AREA_THRESHOLD else _GRID_SPACING_FINE

    min_x, max_x, min_z, max_z = compute_bounding_box(footprint)
    grid: List[Point2D] = []

    x = min_x + grid_spacing / 2.0
    while x < max_x:
        z = min_z + grid_spacing / 2.0
        while z < max_z:
            if point_in_polygon((x, z), footprint):
                grid.append((x, z))
            z += grid_spacing
        x += grid_spacing

    return grid


# ---------------------------------------------------------------------------
# Step 3: Visibility
# ---------------------------------------------------------------------------

def compute_visible_grid_points(
    cam_pos: Point2D,
    yaw_degrees: float,
    fov_degrees: float,
    coverage_radius: float,
    grid_points: List[Point2D],
    walls: List[WallSegment],
) -> FrozenSet[int]:
    """
    Return frozenset of grid point indices visible from cam_pos at the given yaw.
    A point is visible if: within coverage_radius, within FOV half-angle, and
    no wall occludes the ray.
    """
    half_fov = fov_degrees / 2.0
    radius_sq = coverage_radius * coverage_radius
    visible: Set[int] = set()

    for idx, gp in enumerate(grid_points):
        dx = gp[0] - cam_pos[0]
        dz = gp[1] - cam_pos[1]
        dist_sq = dx * dx + dz * dz
        if dist_sq > radius_sq:
            continue
        bearing = angle_to_point(cam_pos, gp)
        if angular_difference(bearing, yaw_degrees) > half_fov:
            continue
        if ray_hits_any_wall(cam_pos, gp, walls):
            continue
        visible.add(idx)

    return frozenset(visible)


# ---------------------------------------------------------------------------
# Step 4: Greedy placement
# ---------------------------------------------------------------------------

def greedy_place_cameras(
    footprint: List[Point2D],
    walls: List[WallSegment],
    camera_count: int,
    camera_y: float,
    building_id: str,
    fov_degrees: float = 60.0,
    coverage_radius: float = 50.0,
    grid_spacing: Optional[float] = None,
    inset_distance: float = _INSET_DISTANCE,
    yaw_step_degrees: float = _YAW_STEP,
) -> PlacementResult:
    centroid = polygon_centroid(footprint)
    candidates = generate_candidate_positions(footprint, centroid, inset_distance)

    if not candidates:
        raise ValueError("No valid candidate positions found inside the footprint")

    grid_points = build_coverage_grid(footprint, grid_spacing)
    if not grid_points:
        raise ValueError("Footprint is too small to contain any coverage grid points")

    total = len(grid_points)
    effective_count = min(camera_count, len(candidates))

    # Precompute visibility for all (candidate, yaw) combinations
    yaw_values = [i * yaw_step_degrees for i in range(int(360 / yaw_step_degrees))]
    visibility_cache: Dict[int, Dict[float, FrozenSet[int]]] = {}
    for cand_idx, cam_pos in enumerate(candidates):
        visibility_cache[cand_idx] = {}
        for yaw in yaw_values:
            visibility_cache[cand_idx][yaw] = compute_visible_grid_points(
                cam_pos, yaw, fov_degrees, coverage_radius, grid_points, walls
            )

    # Greedy set-cover loop
    uncovered: Set[int] = set(range(total))
    used: Set[int] = set()
    placed_cameras: List[Camera] = []

    for camera_num in range(effective_count):
        best_score = -1
        best_cand_idx = 0
        best_yaw = 0.0
        best_visible: FrozenSet[int] = frozenset()

        for cand_idx in range(len(candidates)):
            if cand_idx in used:
                continue
            for yaw, visible_set in visibility_cache[cand_idx].items():
                score = len(visible_set & uncovered)
                if score > best_score:
                    best_score = score
                    best_cand_idx = cand_idx
                    best_yaw = yaw
                    best_visible = visible_set

        used.add(best_cand_idx)
        uncovered -= best_visible

        placement_score = round(min(1.0, len(best_visible) / total), 4)
        cam_pos = candidates[best_cand_idx]

        placed_cameras.append(Camera(
            id=f"cam_{camera_num + 1}",
            building_id=building_id,
            position=CameraPosition(x=cam_pos[0], y=camera_y, z=cam_pos[1]),
            rotation=CameraRotation(yaw=round(best_yaw, 2), pitch=_PITCH),
            fov=fov_degrees,
            coverage_radius=coverage_radius,
            placement_score=placement_score,
        ))

    covered = total - len(uncovered)
    overall_coverage_score = round(covered / total, 4) if total > 0 else 0.0

    return PlacementResult(cameras=placed_cameras, overall_coverage_score=overall_coverage_score)


# ---------------------------------------------------------------------------
# Step 5: Public entry point
# ---------------------------------------------------------------------------

def place_cameras(request: PlacementRequest) -> PlacementResult:
    """
    Validate inputs, resolve walls, normalize polygon, and run greedy placement.
    Raises ValueError with a descriptive message for invalid inputs.
    """
    footprint = request.footprint

    if len(footprint) < 3:
        raise ValueError("footprint must have at least 3 vertices")

    area = abs(polygon_area(footprint))
    if area < 1e-6:
        raise ValueError("footprint has zero or near-zero area")

    if request.camera_count < 1:
        raise ValueError("camera_count must be at least 1")

    footprint = ensure_ccw(footprint)
    walls = footprint_edges_as_walls(footprint)
    if request.walls:
        walls = walls + request.walls

    return greedy_place_cameras(
        footprint=footprint,
        walls=walls,
        camera_count=request.camera_count,
        camera_y=request.camera_y,
        building_id=request.building_id,
        fov_degrees=request.fov_degrees,
        coverage_radius=request.coverage_radius,
    )
