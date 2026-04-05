// Watchman API client.
// On merge: add these functions to /frontend/src/lib/api.ts

import type {
  WatchmanCamera,
  WatchmanIncident,
  WatchmanDispatchEntry,
  WatchmanWsMessage,
} from "./watchman-types";

const API_BASE =
  process.env.NEXT_PUBLIC_WATCHMAN_API_URL ?? "http://localhost:8002";

const WS_BASE = API_BASE.replace(/^http/, "ws");

// ── REST helpers ──────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error ?? body?.detail ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function resolveWatchmanIncident(cameraId: string): Promise<void> {
  await request(`/cameras/${cameraId}/resolve`, { method: "POST" });
}

export async function triggerWatchmanAnalysis(cameraId: string): Promise<void> {
  await request(`/cameras/${cameraId}/analyze`, { method: "POST" });
}

export async function queryWatchman(
  question: string
): Promise<{ answer: string; question: string }> {
  return request("/query", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// ── WebSocket client ──────────────────────────────────────────────────────────

export interface WatchmanWsHandlers {
  onSnapshot: (
    cameras: WatchmanCamera[],
    incidents: WatchmanIncident[],
    dispatch: WatchmanDispatchEntry[]
  ) => void;
  onCameraOk: (cameraId: string, analyzedAt: number) => void;
  onIncidentDetected: (
    camera: WatchmanCamera,
    incident: WatchmanIncident,
    dispatch: WatchmanDispatchEntry
  ) => void;
  onIncidentResolved: (
    cameraId: string,
    incidentId: string,
    resolvedAt: number
  ) => void;
  onConnectionChange: (connected: boolean) => void;
}

export function connectWatchmanWs(handlers: WatchmanWsHandlers): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let delay = 1000;

  function connect() {
    if (destroyed) return;
    ws = new WebSocket(`${WS_BASE}/ws`);

    ws.onopen = () => {
      delay = 1000;
      handlers.onConnectionChange(true);
    };

    ws.onmessage = (ev) => {
      let msg: WatchmanWsMessage;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }

      switch (msg.type) {
        case "snapshot":
          handlers.onSnapshot(msg.cameras, msg.activeIncidents, msg.dispatchLog);
          break;
        case "camera_ok":
          handlers.onCameraOk(msg.cameraId, msg.analyzedAt);
          break;
        case "incident_detected":
          handlers.onIncidentDetected(msg.camera, msg.incident, msg.dispatch);
          break;
        case "incident_resolved":
          handlers.onIncidentResolved(
            msg.cameraId,
            msg.incidentId,
            msg.resolvedAt
          );
          break;
        case "ping":
          break;
      }
    };

    ws.onclose = () => {
      handlers.onConnectionChange(false);
      if (!destroyed) {
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 1.5, 30_000);
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return () => {
    destroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
