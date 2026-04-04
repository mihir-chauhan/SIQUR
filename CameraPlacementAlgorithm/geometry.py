import math
from typing import List, Tuple

from .models import Point2D, WallSegment


def polygon_area(polygon: List[Point2D]) -> float:
    """Shoelace formula. Positive = CCW, negative = CW."""
    n = len(polygon)
    area = 0.0
    for i in range(n):
        x1, z1 = polygon[i]
        x2, z2 = polygon[(i + 1) % n]
        area += x1 * z2 - x2 * z1
    return area / 2.0


def ensure_ccw(polygon: List[Point2D]) -> List[Point2D]:
    """Return polygon vertices in counter-clockwise order."""
    if polygon_area(polygon) < 0:
        return list(reversed(polygon))
    return list(polygon)


def point_in_polygon(point: Point2D, polygon: List[Point2D]) -> bool:
    """
    Ray-casting algorithm. Returns True if point is strictly inside the polygon.
    Points exactly on the boundary return False.
    """
    px, pz = point
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, zi = polygon[i]
        xj, zj = polygon[j]
        if ((zi > pz) != (zj > pz)) and (px < (xj - xi) * (pz - zi) / (zj - zi) + xi):
            inside = not inside
        j = i
    return inside


def segment_intersects_segment(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    p4: Point2D,
    epsilon: float = 1e-10,
) -> bool:
    """
    Parametric intersection test using cross products.
    Returns True if segments (p1,p2) and (p3,p4) properly intersect.
    Parallel/collinear segments return False.
    Shared endpoints are not counted as intersections (prevents false positives
    when a camera sits at a polygon vertex).
    """
    d1x = p2[0] - p1[0]
    d1z = p2[1] - p1[1]
    d2x = p4[0] - p3[0]
    d2z = p4[1] - p3[1]

    denom = d1x * d2z - d1z * d2x
    if abs(denom) < epsilon:
        return False  # parallel or collinear

    dx = p3[0] - p1[0]
    dz = p3[1] - p1[1]

    t = (dx * d2z - dz * d2x) / denom
    u = (dx * d1z - dz * d1x) / denom

    # Strictly interior intersection (exclude shared endpoints)
    return epsilon < t < 1 - epsilon and epsilon < u < 1 - epsilon


def ray_hits_any_wall(
    origin: Point2D,
    target: Point2D,
    walls: List[WallSegment],
) -> bool:
    """Return True if any wall segment blocks the line of sight from origin to target."""
    for x1, z1, x2, z2 in walls:
        if segment_intersects_segment(origin, target, (x1, z1), (x2, z2)):
            return True
    return False


def footprint_edges_as_walls(polygon: List[Point2D]) -> List[WallSegment]:
    """Convert a closed polygon into wall segments. Skips zero-length edges."""
    walls: List[WallSegment] = []
    n = len(polygon)
    for i in range(n):
        x1, z1 = polygon[i]
        x2, z2 = polygon[(i + 1) % n]
        length = math.hypot(x2 - x1, z2 - z1)
        if length > 1e-6:
            walls.append((x1, z1, x2, z2))
    return walls


def compute_bounding_box(polygon: List[Point2D]) -> Tuple[float, float, float, float]:
    """Returns (min_x, max_x, min_z, max_z)."""
    xs = [p[0] for p in polygon]
    zs = [p[1] for p in polygon]
    return min(xs), max(xs), min(zs), max(zs)


def angle_to_point(origin: Point2D, target: Point2D) -> float:
    """
    Bearing in degrees [0, 360), clockwise from +Z axis.
    yaw=0 → facing +Z, yaw=90 → facing +X.
    """
    dx = target[0] - origin[0]
    dz = target[1] - origin[1]
    angle = math.degrees(math.atan2(dx, dz))
    return angle % 360.0


def angular_difference(a: float, b: float) -> float:
    """Minimum absolute angular difference between two angles in degrees. Result in [0, 180]."""
    diff = abs(a - b) % 360.0
    if diff > 180.0:
        diff = 360.0 - diff
    return diff


def _inward_normal(x1: float, z1: float, x2: float, z2: float, centroid: Point2D) -> Tuple[float, float]:
    """Return the unit normal for edge (p1→p2) that points toward the centroid."""
    ex = x2 - x1
    ez = z2 - z1
    length = math.hypot(ex, ez)
    if length < 1e-9:
        return (0.0, 0.0)
    ex /= length
    ez /= length
    # Two candidate normals (rotate 90° left and right)
    n1 = (-ez, ex)
    n2 = (ez, -ex)
    # Pick the one pointing toward the centroid
    mid_x = (x1 + x2) / 2.0
    mid_z = (z1 + z2) / 2.0
    to_cx = centroid[0] - mid_x
    to_cz = centroid[1] - mid_z
    if n1[0] * to_cx + n1[1] * to_cz >= 0:
        return n1
    return n2


def polygon_centroid(polygon: List[Point2D]) -> Point2D:
    """Simple arithmetic centroid."""
    cx = sum(p[0] for p in polygon) / len(polygon)
    cz = sum(p[1] for p in polygon) / len(polygon)
    return (cx, cz)
