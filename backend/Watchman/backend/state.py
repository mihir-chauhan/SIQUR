"""
In-memory state for Watchman.

All mutable state lives here behind a threading.Lock so the
asyncio event loop and the ThreadPoolExecutor Qwen thread can
both touch it safely.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Optional

from scenes import CAMERAS


# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class Incident:
    id: str
    camera_id: str
    type: str           # "crime_assault" | "fire_smoke" | "unauthorized_access" | "medical_emergency"
    severity: str       # "low" | "medium" | "high"
    description: str
    detected_at: float  # unix timestamp
    resolved_at: Optional[float] = None
    dispatched: bool = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "cameraId": self.camera_id,
            "type": self.type,
            "severity": self.severity,
            "description": self.description,
            "detectedAt": self.detected_at * 1000,
            "resolvedAt": self.resolved_at * 1000 if self.resolved_at else None,
            "dispatched": self.dispatched,
        }

    def to_log_line(self) -> str:
        """Human-readable line for Qwen context."""
        dt = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.detected_at))
        resolved = ""
        if self.resolved_at:
            rt = time.strftime("%H:%M:%S", time.localtime(self.resolved_at))
            resolved = f", resolved at {rt}"
        cam = cameras.get(self.camera_id)
        cam_label = cam.label if cam else self.camera_id
        return (
            f"[{dt}] INCIDENT #{self.id} — {self.type.upper()} ({self.severity}) "
            f"at {cam_label}: {self.description}{resolved}"
        )


@dataclass
class DispatchEntry:
    id: str
    camera_id: str
    camera_label: str
    incident_type: str
    message: str
    timestamp: float
    simulated: bool = True

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "cameraId": self.camera_id,
            "cameraLabel": self.camera_label,
            "incidentType": self.incident_type,
            "message": self.message,
            "timestamp": self.timestamp * 1000,
            "simulated": self.simulated,
        }


@dataclass
class WatchmanCamera:
    id: str
    label: str
    location: str
    scene_pool: list[str]
    status: str = "nominal"         # "nominal" | "incident"
    last_analyzed: float = field(default_factory=time.time)
    current_incident: Optional[Incident] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "location": self.location,
            "status": self.status,
            "lastAnalyzed": self.last_analyzed * 1000,
            "currentIncident": self.current_incident.to_dict() if self.current_incident else None,
        }


# ── Module-level state ────────────────────────────────────────────────────────

_lock = threading.Lock()

cameras: dict[str, WatchmanCamera] = {
    c["id"]: WatchmanCamera(
        id=c["id"],
        label=c["label"],
        location=c["location"],
        scene_pool=c["scenes"],
    )
    for c in CAMERAS
}

incidents: dict[str, Incident] = {}        # active incidents keyed by incident id
incident_history: list[Incident] = []      # ALL incidents ever detected (newest first)
dispatch_log: list[DispatchEntry] = []     # newest first, capped at 100

_model_status: str = "loading"             # "loading" | "ready" | "error"


# ── Helpers ───────────────────────────────────────────────────────────────────

def set_model_status(status: str) -> None:
    global _model_status
    _model_status = status


def get_model_status() -> str:
    return _model_status


def get_snapshot() -> dict:
    with _lock:
        return {
            "cameras": [c.to_dict() for c in cameras.values()],
            "activeIncidents": [i.to_dict() for i in incidents.values()],
            "dispatchLog": [d.to_dict() for d in dispatch_log],
        }


def build_query_context() -> str:
    """
    Build a chronological text log of all incidents and dispatches
    for Qwen to reason over when answering user questions.
    """
    with _lock:
        if not incident_history:
            return "No incidents have been detected yet."

        # Sort oldest-first for chronological context
        sorted_incidents = sorted(incident_history, key=lambda i: i.detected_at)
        lines = ["=== WATCHMAN SECURITY INCIDENT LOG ===", ""]
        for inc in sorted_incidents:
            lines.append(inc.to_log_line())
        lines.append("")
        lines.append(f"Total incidents on record: {len(sorted_incidents)}")
        now_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        lines.append(f"Current time: {now_str}")
        return "\n".join(lines)


def record_incident(camera_id: str, incident: Incident, dispatch: DispatchEntry) -> None:
    with _lock:
        cameras[camera_id].status = "incident"
        cameras[camera_id].current_incident = incident
        cameras[camera_id].last_analyzed = incident.detected_at
        incidents[incident.id] = incident
        incident_history.insert(0, incident)
        dispatch_log.insert(0, dispatch)
        if len(dispatch_log) > 100:
            dispatch_log.pop()


def resolve_incident(camera_id: str) -> Optional[str]:
    """Returns the resolved incident id, or None if nothing to resolve."""
    with _lock:
        cam = cameras.get(camera_id)
        if not cam or not cam.current_incident:
            return None
        incident_id = cam.current_incident.id
        now = time.time()
        if incident_id in incidents:
            incidents[incident_id].resolved_at = now
            # Update the resolved_at in history too
            for inc in incident_history:
                if inc.id == incident_id:
                    inc.resolved_at = now
                    break
            del incidents[incident_id]
        cam.status = "nominal"
        cam.current_incident = None
        cam.last_analyzed = now
        return incident_id


def mark_analyzed(camera_id: str) -> None:
    with _lock:
        if camera_id in cameras:
            cameras[camera_id].last_analyzed = time.time()
