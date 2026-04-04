"use client";

import type { Camera } from "@/lib/types";

interface FNAFSwitcherProps {
  cameras: Camera[];
  activeCameraId: string;
  onSwitch: (cameraId: string) => void;
}

export default function FNAFSwitcher({
  cameras,
  activeCameraId,
  onSwitch,
}: FNAFSwitcherProps) {
  return (
    <nav
      aria-label="Camera switcher"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.92)",
        borderTop: "1px solid rgba(0, 229, 255, 0.15)",
        backdropFilter: "blur(10px)",
        padding: "6px 16px 8px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
      }}
    >
      {/* Left label */}
      <span
        style={{
          flex: "0 0 auto",
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          letterSpacing: "0.3em",
          color: "var(--color-accent-cyan)",
          opacity: 0.5,
          marginRight: 8,
          whiteSpace: "nowrap",
        }}
      >
        FEED SELECT
      </span>

      {/* Divider */}
      <span
        style={{
          flex: "0 0 auto",
          width: 1,
          height: 28,
          background: "rgba(0, 229, 255, 0.15)",
          marginRight: 6,
        }}
      />

      {cameras.map((cam, index) => {
        const isActive = cam.id === activeCameraId;
        const padded = String(index + 1).padStart(2, "0");
        return (
          <button
            key={cam.id}
            type="button"
            onClick={() => onSwitch(cam.id)}
            aria-label={`Camera ${padded}${isActive ? ", currently active" : ", click to switch"}`}
            className={isActive ? "glow-cyan-box" : ""}
            style={{
              flex: "0 0 auto",
              minWidth: 88,
              padding: "6px 12px 8px",
              background: isActive
                ? "rgba(0, 229, 255, 0.08)"
                : "rgba(10, 10, 10, 0.95)",
              border: isActive
                ? "1px solid rgba(0, 229, 255, 0.6)"
                : "1px solid rgba(0, 229, 255, 0.12)",
              borderRadius: 2,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              color: isActive
                ? "var(--color-accent-cyan)"
                : "var(--color-text-dim)",
              cursor: "pointer",
              transition:
                "border-color var(--duration-fast) ease, color var(--duration-fast) ease, background var(--duration-fast) ease, box-shadow var(--duration-fast) ease",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(0, 229, 255, 0.4)";
                el.style.color = "var(--color-accent-cyan)";
                el.style.boxShadow = "0 0 8px rgba(0, 229, 255, 0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(0, 229, 255, 0.12)";
                el.style.color = "var(--color-text-dim)";
                el.style.boxShadow = "none";
              }
            }}
          >
            <span style={{ fontWeight: 700 }}>CAM-{padded}</span>
            <span
              style={{
                fontSize: 7,
                letterSpacing: "0.1em",
                opacity: isActive ? 0.8 : 0.4,
                color: isActive ? "var(--color-accent-green)" : "var(--color-text-dim)",
              }}
            >
              {isActive ? "ACTIVE" : "STANDBY"}
            </span>
          </button>
        );
      })}

      {/* Right status */}
      <span
        style={{
          flex: "0 0 auto",
          marginLeft: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          letterSpacing: "0.2em",
          color: "var(--color-text-dim)",
          opacity: 0.5,
          whiteSpace: "nowrap",
        }}
      >
        {cameras.length} UNITS
      </span>
    </nav>
  );
}
