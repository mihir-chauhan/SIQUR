from dataclasses import dataclass
from typing import List, Optional, Tuple

# Type aliases
Point2D = Tuple[float, float]                        # (x, z) in splat world space
WallSegment = Tuple[float, float, float, float]      # (x1, z1, x2, z2)


@dataclass
class PlacementRequest:
    footprint: List[Point2D]
    camera_count: int
    camera_y: float
    building_id: str
    walls: Optional[List[WallSegment]] = None  # interior walls; footprint edges always added
    fov_degrees: float = 60.0
    coverage_radius: float = 50.0


@dataclass
class CameraPosition:
    x: float
    y: float
    z: float


@dataclass
class CameraRotation:
    yaw: float    # degrees, 0-360 (clockwise from +Z axis)
    pitch: float  # degrees, -90 to 90 (negative = downward)


@dataclass
class Camera:
    id: str
    building_id: str
    position: CameraPosition
    rotation: CameraRotation
    fov: float
    coverage_radius: float
    placement_score: float  # fraction of total grid covered by this camera, 0.0-1.0


@dataclass
class PlacementResult:
    cameras: List[Camera]
    overall_coverage_score: float  # union coverage of all cameras, 0.0-1.0
