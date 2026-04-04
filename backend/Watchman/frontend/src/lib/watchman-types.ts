// Watchman-specific types.
// On merge: append these to /frontend/src/lib/types.ts

export type WatchmanIncidentType =
  | "crime_assault"
  | "fire_smoke"
  | "unauthorized_access"
  | "medical_emergency";

export type WatchmanCameraStatus = "nominal" | "incident";

export interface WatchmanIncident {
  id: string;
  cameraId: string;
  type: WatchmanIncidentType;
  severity: "low" | "medium" | "high";
  description: string;
  detectedAt: number; // unix ms
  resolvedAt: number | null;
  dispatched: boolean;
}

export interface WatchmanCamera {
  id: string;
  label: string;
  location: string;
  status: WatchmanCameraStatus;
  lastAnalyzed: number; // unix ms
  currentIncident: WatchmanIncident | null;
}

export interface WatchmanDispatchEntry {
  id: string;
  cameraId: string;
  cameraLabel: string;
  incidentType: string;
  message: string;
  timestamp: number; // unix ms
  simulated: true;
}

export interface WatchmanQueryEntry {
  id: string;
  question: string;
  answer: string;
  askedAt: number; // unix ms
}

// WebSocket message discriminated union
export type WatchmanWsMessage =
  | {
      type: "snapshot";
      cameras: WatchmanCamera[];
      activeIncidents: WatchmanIncident[];
      dispatchLog: WatchmanDispatchEntry[];
    }
  | { type: "camera_ok"; cameraId: string; analyzedAt: number }
  | {
      type: "incident_detected";
      camera: WatchmanCamera;
      incident: WatchmanIncident;
      dispatch: WatchmanDispatchEntry;
    }
  | {
      type: "incident_resolved";
      cameraId: string;
      incidentId: string;
      resolvedAt: number;
    }
  | { type: "ping" };
