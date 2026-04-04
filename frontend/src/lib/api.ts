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
} from "@/lib/types";
import * as mockApi from "./mock-api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Fallback helper: try real API, fall back to mock on network errors ────────

async function withFallback<T>(
  realCall: () => Promise<T>,
  mockCall: () => Promise<T>
): Promise<T> {
  try {
    return await realCall();
  } catch (err: unknown) {
    // Network-level failures (backend unreachable)
    const isNetworkError =
      (err instanceof TypeError && err.message.includes("fetch")) ||
      (err instanceof TypeError && err.message.includes("Failed")) ||
      (err instanceof TypeError && err.message.includes("NetworkError")) ||
      (err instanceof DOMException && err.name === "AbortError");

    if (isNetworkError) {
      console.warn("[API] Backend unavailable, using mock data");
      return mockCall();
    }

    throw err;
  }
}

// ── Real API request helper ──────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
      // ignore parse error, use status message
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── Exported API functions (each with automatic mock fallback) ────────────────

export async function createSession(): Promise<CreateSessionResponse> {
  return withFallback(
    () => request<CreateSessionResponse>("/session", { method: "POST" }),
    () => mockApi.createSession()
  );
}

export async function deleteSession(
  sessionId: string
): Promise<{ ok: boolean }> {
  return withFallback(
    async () => {
      await request<void>(`/session/${sessionId}`, { method: "DELETE" });
      return { ok: true };
    },
    () => mockApi.deleteSession(sessionId)
  );
}

export async function setBuilding(
  sessionId: string,
  data: SetBuildingRequest
): Promise<SetBuildingResponse> {
  return withFallback(
    () =>
      request<SetBuildingResponse>(`/session/${sessionId}/building`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    () => mockApi.setBuilding(sessionId, data)
  );
}

export async function getBuilding(
  sessionId: string
): Promise<GetBuildingResponse> {
  return withFallback(
    () => request<GetBuildingResponse>(`/session/${sessionId}/building`),
    () => mockApi.getBuilding(sessionId)
  );
}

export async function placeCameras(
  sessionId: string,
  cameraCount: number
): Promise<PlaceCamerasResponse> {
  return withFallback(
    () =>
      request<PlaceCamerasResponse>(`/session/${sessionId}/cameras/place`, {
        method: "POST",
        body: JSON.stringify({ camera_count: cameraCount }),
      }),
    () => mockApi.placeCameras(sessionId, cameraCount)
  );
}

export async function getCameras(
  sessionId: string
): Promise<GetCamerasResponse> {
  return withFallback(
    () => request<GetCamerasResponse>(`/session/${sessionId}/cameras`),
    () => mockApi.getCameras(sessionId)
  );
}

export async function getCamera(
  sessionId: string,
  cameraId: string
): Promise<GetCameraResponse> {
  return withFallback(
    () =>
      request<GetCameraResponse>(
        `/session/${sessionId}/cameras/${cameraId}`
      ),
    () => mockApi.getCamera(sessionId, cameraId)
  );
}

export async function startSimulation(
  sessionId: string,
  cameraId: string,
  prompt: string
): Promise<SimulateResponse> {
  return withFallback(
    () =>
      request<SimulateResponse>(
        `/session/${sessionId}/cameras/${cameraId}/simulate`,
        {
          method: "POST",
          body: JSON.stringify({ prompt }),
        }
      ),
    () => mockApi.startSimulation(sessionId, cameraId, prompt)
  );
}

export async function getSimulation(
  sessionId: string,
  cameraId: string
): Promise<GetSimulationResponse> {
  return withFallback(
    () =>
      request<GetSimulationResponse>(
        `/session/${sessionId}/cameras/${cameraId}/simulation`
      ),
    () => mockApi.getSimulation(sessionId, cameraId)
  );
}

export function pollSimulation(
  sessionId: string,
  cameraId: string,
  onUpdate: (result: GetSimulationResponse) => void,
  intervalMs = 2000
): () => void {
  let stopped = false;
  let usingMock = false;

  const tick = async () => {
    if (stopped) return;

    try {
      const result = await getSimulation(sessionId, cameraId);
      if (stopped) return;

      // If getSimulation succeeded via mock fallback, the first call already
      // returns "complete". Detect by checking if we keep getting instant
      // complete responses on what should be a pending simulation.
      onUpdate(result);

      if (result.status === "complete" || result.status === "failed") {
        return;
      }
    } catch {
      // On persistent network errors, fall back to mock polling
      if (!usingMock) {
        usingMock = true;
        mockApi.pollSimulation(sessionId, cameraId, onUpdate, intervalMs);
        return;
      }
    }

    if (!stopped) {
      setTimeout(tick, intervalMs);
    }
  };

  setTimeout(tick, intervalMs);

  return () => {
    stopped = true;
  };
}
