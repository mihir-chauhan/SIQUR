import type { Camera } from "./types";

const SESSION_KEY = "minority_report_session";
const BUILDING_KEY = "minority_report_building";
const CAMERAS_KEY = "minority_report_placed_cameras";

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function getSelectedBuilding(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUILDING_KEY);
}

export function setSelectedBuilding(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUILDING_KEY, id);
}

// Placed cameras — persisted so /camera/[id] can read them
export function getPlacedCameras(): Camera[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CAMERAS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function setPlacedCameras(cameras: Camera[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CAMERAS_KEY, JSON.stringify(cameras));
}

export function addPlacedCamera(camera: Camera): void {
  const cameras = getPlacedCameras();
  cameras.push(camera);
  setPlacedCameras(cameras);
}
