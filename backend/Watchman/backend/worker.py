"""
Background poll loop.

Scans cameras in round-robin order. For each camera, picks a random
scene from its pool, runs Qwen analysis in an executor thread, then
broadcasts the result to all WebSocket clients.

Staggered timing: one camera analyzed every (POLL_INTERVAL / num_cameras)
seconds so all cameras complete a full cycle within POLL_INTERVAL seconds.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import time
import uuid
from typing import Callable, Awaitable

import model
import state

POLL_INTERVAL = float(os.environ.get("WATCHMAN_POLL_INTERVAL", "15"))

_broadcast_fn: Callable[[dict], Awaitable[None]] | None = None
_executor = None  # set by app.py before starting the loop


def init(broadcast: Callable[[dict], Awaitable[None]], executor) -> None:
    global _broadcast_fn, _executor
    _broadcast_fn = broadcast
    _executor = executor


async def poll_loop() -> None:
    camera_ids = list(state.cameras.keys())
    num_cameras = len(camera_ids)
    sleep_per_camera = POLL_INTERVAL / num_cameras
    idx = 0

    while True:
        camera_id = camera_ids[idx % num_cameras]
        idx += 1

        cam = state.cameras[camera_id]
        scene = random.choice(cam.scene_pool)

        try:
            loop = asyncio.get_event_loop()
            raw = await loop.run_in_executor(_executor, model.run_analysis, scene)
            result = model.parse_response(raw)
        except Exception as exc:
            print(f"[worker] analysis error for {camera_id}: {exc}")
            result = None

        now = time.time()

        if result and result.get("incident"):
            # Only fire a new incident if the camera isn't already alarming
            if cam.status != "incident":
                incident = state.Incident(
                    id=uuid.uuid4().hex[:8],
                    camera_id=camera_id,
                    type=result["type"],
                    severity=result.get("severity", "medium"),
                    description=result.get("description") or _default_description(result["type"]),
                    detected_at=now,
                    dispatched=True,
                )
                dispatch = _make_dispatch(cam, incident, now)
                state.record_incident(camera_id, incident, dispatch)

                msg = {
                    "type": "incident_detected",
                    "camera": state.cameras[camera_id].to_dict(),
                    "incident": incident.to_dict(),
                    "dispatch": dispatch.to_dict(),
                }
                if _broadcast_fn:
                    await _broadcast_fn(msg)
                print(f"[worker] INCIDENT on {camera_id}: {incident.type} ({incident.severity})")
            else:
                # Camera already alarming — skip but don't reset
                state.mark_analyzed(camera_id)
        else:
            if cam.status == "incident":
                # Clean scan — auto-resolve
                incident_id = state.resolve_incident(camera_id)
                if incident_id:
                    msg = {
                        "type": "incident_resolved",
                        "cameraId": camera_id,
                        "incidentId": incident_id,
                        "resolvedAt": now * 1000,
                    }
                    if _broadcast_fn:
                        await _broadcast_fn(msg)
                    print(f"[worker] resolved {camera_id}")
            else:
                state.mark_analyzed(camera_id)
                msg = {
                    "type": "camera_ok",
                    "cameraId": camera_id,
                    "analyzedAt": now * 1000,
                }
                if _broadcast_fn:
                    await _broadcast_fn(msg)

        await asyncio.sleep(sleep_per_camera)


def _make_dispatch(cam: state.WatchmanCamera, incident: state.Incident, now: float) -> state.DispatchEntry:
    service = _service_for(incident.type)
    time_str = time.strftime("%H:%M", time.localtime(now))
    type_label = _type_label(incident.type)
    message = f"{service} dispatched to {cam.label} — {type_label} detected at {time_str}"
    return state.DispatchEntry(
        id=uuid.uuid4().hex[:8],
        camera_id=cam.id,
        camera_label=cam.label,
        incident_type=incident.type,
        message=message,
        timestamp=now,
        simulated=True,
    )


def _service_for(incident_type: str) -> str:
    return {
        "crime_assault": "Police (911)",
        "fire_smoke": "Fire Dept (911)",
        "unauthorized_access": "Security",
        "medical_emergency": "EMS (911)",
    }.get(incident_type, "Emergency Services")


def _type_label(incident_type: str) -> str:
    return {
        "crime_assault": "Assault / Crime",
        "fire_smoke": "Fire / Smoke",
        "unauthorized_access": "Unauthorized Access",
        "medical_emergency": "Medical Emergency",
    }.get(incident_type, "Incident")


def _default_description(incident_type: str) -> str:
    return {
        "crime_assault": "Aggressive physical altercation detected.",
        "fire_smoke": "Smoke or fire detected in camera view.",
        "unauthorized_access": "Unauthorized access attempt detected.",
        "medical_emergency": "Person unresponsive — possible medical emergency.",
    }.get(incident_type, "Incident detected.")
