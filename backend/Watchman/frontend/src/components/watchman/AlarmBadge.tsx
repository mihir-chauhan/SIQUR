"use client";

import { useEffect, useState } from "react";
import type { WatchmanIncident, WatchmanIncidentType } from "@/lib/watchman-types";

interface AlarmBadgeProps {
  incident: WatchmanIncident;
}

function IncidentIcon({ type }: { type: WatchmanIncidentType }) {
  const style = {
    width: 36,
    height: 36,
    color: "var(--color-accent-red)",
    filter: "drop-shadow(0 0 8px rgba(255,45,45,0.8))",
  };

  switch (type) {
    case "fire_smoke":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden>
          <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
        </svg>
      );
    case "crime_assault":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      );
    case "unauthorized_access":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden>
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
        </svg>
      );
    case "medical_emergency":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden>
          <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" />
        </svg>
      );
  }
}

const TYPE_LABELS: Record<WatchmanIncidentType, string> = {
  fire_smoke: "FIRE / SMOKE",
  crime_assault: "ASSAULT / CRIME",
  unauthorized_access: "UNAUTHORIZED ACCESS",
  medical_emergency: "MEDICAL EMERGENCY",
};

const SEVERITY_COLORS = {
  low: "#ffd600",
  medium: "#ff8c00",
  high: "#ff2d2d",
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function AlarmBadge({ incident }: AlarmBadgeProps) {
  const [elapsed, setElapsed] = useState(Date.now() - incident.detectedAt);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - incident.detectedAt), 1000);
    return () => clearInterval(id);
  }, [incident.detectedAt]);

  const sevColor = SEVERITY_COLORS[incident.severity];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: 10,
        width: "100%",
        textAlign: "center",
      }}
    >
      <IncidentIcon type={incident.type} />

      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "var(--color-accent-red)",
          textShadow: "0 0 8px rgba(255,45,45,0.7)",
        }}
      >
        {TYPE_LABELS[incident.type]}
      </span>

      <span
        style={{
          fontSize: 10,
          color: "var(--color-text)",
          maxWidth: 160,
          lineHeight: 1.35,
          opacity: 0.9,
        }}
      >
        {incident.description}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.06em",
            padding: "1px 6px",
            borderRadius: 2,
            border: `1px solid ${sevColor}66`,
            background: `${sevColor}14`,
            color: sevColor,
          }}
        >
          {incident.severity.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-dim)",
          }}
        >
          {formatElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
}
