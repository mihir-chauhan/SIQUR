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
        background: "rgba(0, 0, 0, 0.88)",
        borderTop: "1px solid rgba(0, 229, 255, 0.12)",
        backdropFilter: "blur(8px)",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        overflowX: "auto",
      }}
    >
      {cameras.map((cam) => {
        const isActive = cam.id === activeCameraId;
        return (
          <button
            key={cam.id}
            type="button"
            onClick={() => onSwitch(cam.id)}
            className={isActive ? "glow-cyan-box" : ""}
            style={{
              flex: "0 0 auto",
              minWidth: 80,
              padding: "8px 14px",
              background: isActive
                ? "rgba(0, 229, 255, 0.08)"
                : "rgba(17, 17, 17, 0.9)",
              border: isActive
                ? "1px solid rgba(0, 229, 255, 0.6)"
                : "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 3,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.15em",
              color: isActive
                ? "var(--color-accent-cyan)"
                : "var(--color-text-dim)",
              cursor: "pointer",
              transition:
                "border-color var(--duration-fast) ease, color var(--duration-fast) ease, background var(--duration-fast) ease",
              textAlign: "center",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(0, 229, 255, 0.3)";
                el.style.color = "var(--color-text)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(255, 255, 255, 0.08)";
                el.style.color = "var(--color-text-dim)";
              }
            }}
          >
            CAM-{cam.id}
          </button>
        );
      })}
    </nav>
  );
}
