// Shared types for frontend and backend
// Frontend: import from this file for type safety
// Backend: use this as reference for response shapes

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  yaw: number;   // degrees, 0-360
  pitch: number; // degrees, -90 to 90
}

export interface Camera {
  id: string;
  building_id: string;
  position: Position;
  rotation: Rotation;
  fov: number;              // field of view in degrees
  coverage_radius: number;  // meters
  placement_score: number;  // 0.0-1.0
}

export interface Building {
  id: string;                              // e.g. "purdue-lawson"
  name: string;                            // e.g. "Lawson Computer Science Building"
  lat: number;
  lng: number;
  footprint_polygon: Array<[number, number]>;  // [[lat, lng], ...]
  splat_asset: string;                    // e.g. "lawson.splat"
}

export interface Simulation {
  camera_id: string;
  status: "pending" | "generating" | "complete" | "failed";
  prompt: string;
  video_url: string | null;               // e.g. "/static/videos/session_id_camera_id.mp4"
  error?: string;                         // if status == "failed"
}

export interface Session {
  session_id: string;
  building: Building | null;
  cameras: Camera[];
  simulation: Simulation | null;
  placement_complete: boolean;
}

// API Request/Response types

export interface CreateSessionResponse {
  session_id: string;
}

export interface SetBuildingRequest {
  building_id: string;          // pre-loaded id or "custom"
  name: string;
  lat: number;
  lng: number;
  footprint_polygon: Array<[number, number]>;
}

export interface SetBuildingResponse {
  building: Building;
}

export interface GetBuildingResponse {
  building: Building | null;
}

export interface PlaceCamerasRequest {
  camera_count: number;  // 1-50
}

export interface PlaceCamerasResponse {
  cameras: Camera[];
  coverage_score: number;  // 0.0-1.0
  placement_complete: boolean;
}

export interface GetCamerasResponse {
  cameras: Camera[];
  placement_complete: boolean;
}

export interface GetCameraResponse {
  camera: Camera;
}

export interface SimulateRequest {
  prompt: string;  // user-provided scenario text
}

export interface SimulateResponse {
  simulation_id: string;
  status: "pending";
  camera_id: string;
  prompt: string;
}

export interface GetSimulationResponse {
  status: "pending" | "generating" | "complete" | "failed";
  prompt: string;
  video_url: string | null;
  error?: string;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}

// API client helper types
export type HttpMethod = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

export interface ApiRequestConfig {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: Record<string, any>;
}

// Pre-loaded buildings constant (for frontend)
export const PRELOADED_BUILDINGS: Building[] = [
  {
    id: "purdue-lawson",
    name: "Lawson Computer Science Building",
    lat: 40.4274,
    lng: -86.9167,
    footprint_polygon: [
      [40.42740, -86.91670],
      [40.42750, -86.91660],
      [40.42750, -86.91680],
      [40.42740, -86.91680]
    ],
    splat_asset: "lawson.splat"
  },
  {
    id: "purdue-pmu",
    name: "Purdue Memorial Union",
    lat: 40.4256,
    lng: -86.9094,
    footprint_polygon: [
      [40.42560, -86.90940],
      [40.42570, -86.90930],
      [40.42570, -86.90950],
      [40.42560, -86.90950]
    ],
    splat_asset: "pmu.splat"
  },
  {
    id: "purdue-armstrong",
    name: "Hall of Data Science and AI",
    lat: 40.4268,
    lng: -86.9145,
    footprint_polygon: [
      [40.42680, -86.91450],
      [40.42690, -86.91440],
      [40.42690, -86.91460],
      [40.42680, -86.91460]
    ],
    splat_asset: "armstrong.splat"
  }
];
