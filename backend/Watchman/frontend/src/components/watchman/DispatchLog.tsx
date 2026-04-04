"use client";

import type { WatchmanDispatchEntry } from "@/lib/watchman-types";

interface DispatchLogProps {
  entries: WatchmanDispatchEntry[];
}

const TYPE_COLORS: Record<string, string> = {
  fire_smoke: "#ff6b35",
  crime_assault: "#ff2d2d",
  unauthorized_access: "#ffd600",
  medical_emergency: "#00e5ff",
};

const TYPE_LABELS: Record<string, string> = {
  fire_smoke: "FIRE",
  crime_assault: "ASSAULT",
  unauthorized_access: "UNAUTH",
  medical_emergency: "MEDICAL",
};

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function DispatchLog({ entries }: DispatchLogProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--color-accent-cyan)",
          }}
        >
          DISPATCH LOG
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--color-text-dim)",
          }}
        >
          {entries.length} entries
        </span>
      </div>

      {/* Entries */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-dim)",
              textAlign: "center",
            }}
          >
            <span>No incidents detected.</span>
            <span>Monitoring active.</span>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="animate-fade-up"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 3,
                padding: "8px 10px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--color-text-dim)",
                  }}
                >
                  {formatTime(entry.timestamp)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: TYPE_COLORS[entry.incidentType] ?? "var(--color-text)",
                  }}
                >
                  {TYPE_LABELS[entry.incidentType] ?? entry.incidentType.toUpperCase()}
                </span>
                {/* [SIMULATED] badge — always shown */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    color: "var(--color-accent-amber)",
                    background: "rgba(255,214,0,0.08)",
                    border: "1px solid rgba(255,214,0,0.25)",
                    borderRadius: 2,
                    padding: "1px 4px",
                    letterSpacing: "0.04em",
                    marginLeft: "auto",
                  }}
                >
                  [SIMULATED]
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text)",
                  lineHeight: 1.4,
                  marginBottom: 3,
                }}
              >
                {entry.message}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--color-text-dim)",
                }}
              >
                {entry.cameraLabel}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
