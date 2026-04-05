"""
scene_engine.py — Multi-camera CCTV scene consistency engine.

Given camera positions/FOVs on a floor plan and an actor path (timed waypoints),
generates per-camera Wan I2V prompts that describe consistent actor appearance
across overlapping views.

Coordinate system (floor plan canvas):
  x: 0.0 = left edge, 1.0 = right edge  (normalized)
  y: 0.0 = top edge,  1.0 = bottom edge
  direction_deg: 0=east(right), 90=south(down), 180=west(left), 270=north(up)
"""
from __future__ import annotations

import math
from typing import Optional


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _angle_diff(a: float, b: float) -> float:
    """Signed difference (a - b) in degrees, result in [-180, 180]."""
    d = (a - b) % 360
    return d - 360 if d > 180 else d


class SceneEngine:
    def __init__(
        self,
        cameras: list[dict],
        actor_config: dict,
        waypoints: list[dict],
        duration: float,
    ):
        """
        cameras: list of camera dicts, each with keys:
            id, name, x, y, direction_deg, fov_deg
            x, y: normalized [0,1] floor plan coordinates
            direction_deg: camera pointing angle (0=right, 90=down, etc.)

        actor_config: {description: str, scenario: str}

        waypoints: list of {t: float, x: float, y: float}
            t in seconds, sorted ascending

        duration: total scene duration in seconds
        """
        self.cameras = cameras
        self.actor_desc = actor_config.get("description", "a person")
        self.scenario   = actor_config.get("scenario", "")
        self.waypoints  = sorted(waypoints, key=lambda w: w["t"])
        self.duration   = duration

    # ── Interpolation ──────────────────────────────────────────────────────

    def actor_at(self, t: float) -> tuple[float, float]:
        """Return normalized (x, y) position at time t via linear interpolation."""
        wps = self.waypoints
        if not wps:
            return 0.5, 0.5
        if t <= wps[0]["t"]:
            return wps[0]["x"], wps[0]["y"]
        if t >= wps[-1]["t"]:
            return wps[-1]["x"], wps[-1]["y"]
        for i in range(len(wps) - 1):
            w0, w1 = wps[i], wps[i + 1]
            if w0["t"] <= t <= w1["t"]:
                s = (t - w0["t"]) / max(w1["t"] - w0["t"], 1e-9)
                return _lerp(w0["x"], w1["x"], s), _lerp(w0["y"], w1["y"], s)
        return wps[-1]["x"], wps[-1]["y"]

    # ── Visibility ─────────────────────────────────────────────────────────

    def visibility(self, cam: dict, actor_pos: tuple[float, float]) -> Optional[dict]:
        """
        Returns None if actor is outside this camera's FOV cone.
        Otherwise returns:
          frame_x: -1.0 (left edge) … 0.0 (center) … +1.0 (right edge)
          distance: euclidean distance in normalized floor plan units
          angle_offset_deg: signed degrees off camera center axis
        """
        cx, cy = cam["x"], cam["y"]
        ax, ay = actor_pos
        dx, dy = ax - cx, ay - cy

        if dx == 0 and dy == 0:
            return {"frame_x": 0.0, "distance": 0.0, "angle_offset_deg": 0.0}

        # Angle from camera to actor (screen coords: 0=right, 90=down)
        actor_deg = math.degrees(math.atan2(dy, dx))
        cam_dir   = cam.get("direction_deg", 0.0)
        fov       = cam.get("fov_deg", 90.0)

        offset = _angle_diff(actor_deg, cam_dir)
        if abs(offset) > fov / 2:
            return None  # outside FOV

        dist    = math.sqrt(dx * dx + dy * dy)   # 0–~1.41 on unit square
        frame_x = offset / (fov / 2)             # normalized -1…+1

        return {
            "frame_x":          frame_x,
            "distance":         dist,
            "angle_offset_deg": offset,
        }

    # ── Human-readable descriptions ────────────────────────────────────────

    def _pos_desc(self, vis: dict) -> str:
        fx, dist = vis["frame_x"], vis["distance"]

        if   fx < -0.6:   horiz = "far left"
        elif fx < -0.2:   horiz = "left side"
        elif fx <  0.2:   horiz = "center"
        elif fx <  0.6:   horiz = "right side"
        else:             horiz = "far right"

        if   dist < 0.12: depth = "very close to camera"
        elif dist < 0.30: depth = "foreground"
        elif dist < 0.55: depth = "mid-frame"
        else:             depth = "background"

        return f"{horiz} of frame, {depth}"

    def _movement_desc(self, t: float, cam: dict) -> str:
        """Relative movement direction from this camera's perspective."""
        eps = min(0.25, self.duration / 8)
        x0, y0 = self.actor_at(t)
        x1, y1 = self.actor_at(t + eps)
        dx, dy = x1 - x0, y1 - y0
        speed = math.sqrt(dx * dx + dy * dy)
        if speed < 4e-4:
            return "standing still"

        move_deg = math.degrees(math.atan2(dy, dx))
        rel      = _angle_diff(move_deg, cam.get("direction_deg", 0.0))

        if   abs(rel) < 30:  return "walking away from camera"
        elif abs(rel) > 150: return "walking toward camera"
        elif rel > 0:        return "walking left to right across frame"
        else:                return "walking right to left across frame"

    # ── Prompt builder ─────────────────────────────────────────────────────

    def prompt_for(self, cam: dict, t: float, scene_desc: str = "") -> str:
        """
        Build a complete Wan I2V prompt for this camera at time t.

        scene_desc: static description of what this camera normally sees
                    (e.g. "interior hallway near stairwell").
        """
        actor_pos = self.actor_at(t)
        vis       = self.visibility(cam, actor_pos)

        # Base — always present
        parts = [
            "Security camera footage, CCTV surveillance, fixed wall-mounted camera, "
            "wide angle lens, monochrome timestamp overlay in corner, film grain, "
            "low dynamic range.",
        ]
        if scene_desc:
            parts.append(scene_desc.rstrip(".") + ".")

        if vis is None:
            # Actor not in frame
            parts += [
                "No people visible in frame.",
                "Static empty scene, minor environmental motion only.",
            ]
        else:
            pos_desc  = self._pos_desc(vis)
            move_desc = self._movement_desc(t, cam)
            parts += [
                f"{self.actor_desc.capitalize()} visible at {pos_desc}, {move_desc}.",
                self.scenario.rstrip(".") + "." if self.scenario else "",
                "Realistic surveillance footage, natural lighting.",
            ]

        return " ".join(p for p in parts if p)

    # ── Batch output ───────────────────────────────────────────────────────

    def all_prompts(
        self,
        scene_descs: dict | None = None,
        t: float | None = None,
    ) -> list[dict]:
        """
        Returns [{camera_id, prompt, visible, visibility}, ...] for every camera.

        t: representative time to use for visibility/prompt generation.
           Defaults to midpoint of the actor's path.
        """
        if t is None:
            if self.waypoints:
                t = (self.waypoints[0]["t"] + self.waypoints[-1]["t"]) / 2.0
            else:
                t = self.duration / 2.0

        scene_descs = scene_descs or {}
        results = []

        for cam in self.cameras:
            actor_pos = self.actor_at(t)
            vis       = self.visibility(cam, actor_pos)
            prompt    = self.prompt_for(cam, t, scene_descs.get(cam["id"], ""))
            results.append({
                "camera_id":  cam["id"],
                "prompt":     prompt,
                "visible":    vis is not None,
                "visibility": vis,
            })

        return results
