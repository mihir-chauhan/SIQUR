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
} from "../../../types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export async function createSession(): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/sessions", { method: "POST" });
}

export async function deleteSession(
  sessionId: string
): Promise<{ ok: boolean }> {
  await request<void>(`/sessions/${sessionId}`, { method: "DELETE" });
  return { ok: true };
}

export async function setBuilding(
  sessionId: string,
  data: SetBuildingRequest
): Promise<SetBuildingResponse> {
  return request<SetBuildingResponse>(`/sessions/${sessionId}/building`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getBuilding(
  sessionId: string
): Promise<GetBuildingResponse> {
  return request<GetBuildingResponse>(`/sessions/${sessionId}/building`);
}

export async function placeCameras(
  sessionId: string,
  cameraCount: number
): Promise<PlaceCamerasResponse> {
  return request<PlaceCamerasResponse>(`/sessions/${sessionId}/cameras`, {
    method: "POST",
    body: JSON.stringify({ camera_count: cameraCount }),
  });
}

export async function getCameras(
  sessionId: string
): Promise<GetCamerasResponse> {
  return request<GetCamerasResponse>(`/sessions/${sessionId}/cameras`);
}

export async function getCamera(
  sessionId: string,
  cameraId: string
): Promise<GetCameraResponse> {
  return request<GetCameraResponse>(
    `/sessions/${sessionId}/cameras/${cameraId}`
  );
}

export async function startSimulation(
  sessionId: string,
  cameraId: string,
  prompt: string
): Promise<SimulateResponse> {
  return request<SimulateResponse>(
    `/sessions/${sessionId}/cameras/${cameraId}/simulate`,
    {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }
  );
}

export async function getSimulation(
  sessionId: string,
  cameraId: string
): Promise<GetSimulationResponse> {
  return request<GetSimulationResponse>(
    `/sessions/${sessionId}/cameras/${cameraId}/simulation`
  );
}

export function pollSimulation(
  sessionId: string,
  cameraId: string,
  onUpdate: (result: GetSimulationResponse) => void,
  intervalMs = 2000
): () => void {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;

    try {
      const result = await getSimulation(sessionId, cameraId);
      if (stopped) return;
      onUpdate(result);

      if (result.status === "complete" || result.status === "failed") {
        return;
      }
    } catch {
      // keep polling on transient errors
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
