/**
 * Mock API layer: returns realistic dummy data when the real backend is unavailable.
 * Every function here mirrors the signature of the corresponding function in api.ts.
 */

import { PRELOADED_BUILDINGS } from "./buildings";
import { getSelectedBuilding } from "./session";
import type {
  CreateSessionResponse,
  SetBuildingRequest,
  SetBuildingResponse,
  GetBuildingResponse,
  PlaceCamerasResponse,
  GetCamerasResponse,
  GetCameraResponse,
  SimulateResponse,
  GetSimulationResponse,
  Camera,
  Building,
} from "./types";

// ── In-memory mock state ─────────────────────────────────────────────────────

let mockCameras: Camera[] = [];
let mockPlacementComplete = false;
let mockBuildingId: string | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeCentroid(polygon: Array<[number, number]>): { lat: number; lng: number } {
  const n = polygon.length;
  const lat = polygon.reduce((sum, p) => sum + p[0], 0) / n;
  const lng = polygon.reduce((sum, p) => sum + p[1], 0) / n;
  return { lat, lng };
}

function angleToCentroid(
  pointLat: number,
  pointLng: number,
  centroidLat: number,
  centroidLng: number
): number {
  const dy = centroidLat - pointLat;
  const dx = centroidLng - pointLng;
  const radians = Math.atan2(dy, dx);
  let degrees = (radians * 180) / Math.PI;
  if (degrees < 0) degrees += 360;
  return degrees;
}

function generateMockCameras(building: Building, count: number): Camera[] {
  const polygon = building.footprint_polygon;
  const centroid = computeCentroid(polygon);

  // Collect candidate positions: corners + edge midpoints
  const candidates: Array<{ lat: number; lng: number }> = [];

  for (let i = 0; i < polygon.length; i++) {
    // Corner
    candidates.push({ lat: polygon[i][0], lng: polygon[i][1] });

    // Midpoint of edge to next vertex
    const next = polygon[(i + 1) % polygon.length];
    candidates.push({
      lat: (polygon[i][0] + next[0]) / 2,
      lng: (polygon[i][1] + next[1]) / 2,
    });
  }

  // If we need more cameras than candidates, cycle through
  const cameras: Camera[] = [];
  for (let i = 0; i < count; i++) {
    const c = candidates[i % candidates.length];

    // Convert lat/lng offset from centroid into approximate metres for x/z
    const latDiffM = (c.lat - centroid.lat) * 111_000;
    const lngDiffM =
      (c.lng - centroid.lng) * 111_000 * Math.cos((centroid.lat * Math.PI) / 180);

    const yaw = angleToCentroid(c.lat, c.lng, centroid.lat, centroid.lng);

    cameras.push({
      id: `cam_${i + 1}`,
      building_id: building.id,
      position: { x: lngDiffM, y: 2.5, z: latDiffM },
      rotation: { yaw, pitch: -15 },
      fov: 60,
      coverage_radius: 25,
      placement_score: 0.8 + Math.random() * 0.15,
    });
  }

  return cameras;
}

function findBuilding(buildingId: string | null): Building | undefined {
  if (!buildingId) return undefined;
  return PRELOADED_BUILDINGS.find((b) => b.id === buildingId);
}

// ── Mock API functions ───────────────────────────────────────────────────────

export async function createSession(): Promise<CreateSessionResponse> {
  mockCameras = [];
  mockPlacementComplete = false;
  return { session_id: "sess_demo_001" };
}

export async function deleteSession(
  _sessionId: string
): Promise<{ ok: boolean }> {
  mockCameras = [];
  mockPlacementComplete = false;
  mockBuildingId = null;
  return { ok: true };
}

export async function setBuilding(
  _sessionId: string,
  data: SetBuildingRequest
): Promise<SetBuildingResponse> {
  mockBuildingId = data.building_id;
  const preloaded = findBuilding(data.building_id);
  const building: Building = preloaded ?? {
    id: data.building_id,
    name: data.name,
    lat: data.lat,
    lng: data.lng,
    footprint_polygon: data.footprint_polygon,
    splat_asset: `${data.building_id}.splat`,
  };
  return { building };
}

export async function getBuilding(
  _sessionId: string
): Promise<GetBuildingResponse> {
  const id = mockBuildingId ?? getSelectedBuilding();
  const building = findBuilding(id) ?? null;
  return { building };
}

export async function placeCameras(
  _sessionId: string,
  cameraCount: number
): Promise<PlaceCamerasResponse> {
  const id = mockBuildingId ?? getSelectedBuilding();
  const building = findBuilding(id);

  if (!building) {
    throw new Error("No building selected");
  }

  mockCameras = generateMockCameras(building, cameraCount);
  mockPlacementComplete = true;

  return {
    cameras: mockCameras,
    coverage_score: 0.85 + Math.random() * 0.1,
    placement_complete: true,
  };
}

export async function getCameras(
  _sessionId: string
): Promise<GetCamerasResponse> {
  return {
    cameras: mockCameras,
    placement_complete: mockPlacementComplete,
  };
}

export async function getCamera(
  _sessionId: string,
  cameraId: string
): Promise<GetCameraResponse> {
  const cam = mockCameras.find((c) => c.id === cameraId);
  if (!cam) {
    throw new Error(`Camera ${cameraId} not found`);
  }
  return { camera: cam };
}

export async function startSimulation(
  _sessionId: string,
  cameraId: string,
  prompt: string
): Promise<SimulateResponse> {
  return {
    simulation_id: `sim_mock_${Date.now()}`,
    status: "pending",
    camera_id: cameraId,
    prompt,
  };
}

export async function getSimulation(
  _sessionId: string,
  _cameraId: string
): Promise<GetSimulationResponse> {
  return {
    status: "complete",
    prompt: "",
    video_url: null,
  };
}

export function pollSimulation(
  _sessionId: string,
  _cameraId: string,
  onUpdate: (result: GetSimulationResponse) => void,
  _intervalMs = 2000
): () => void {
  // In mock mode, immediately report complete (no actual video)
  setTimeout(() => {
    onUpdate({
      status: "complete",
      prompt: "",
      video_url: null,
    });
  }, 1500);

  return () => {};
}
