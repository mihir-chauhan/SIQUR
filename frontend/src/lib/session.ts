const SESSION_KEY = "minority_report_session";
const BUILDING_KEY = "minority_report_building";

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
