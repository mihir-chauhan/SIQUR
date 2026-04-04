"use client";

import { useState } from "react";
import { PRELOADED_BUILDINGS } from "@/lib/buildings";
import type { Building } from "@/lib/types";

interface GlobeSidebarProps {
  onBuildingSelect: (building: Building) => void;
}

const VISION_MODES = [
  { label: "STANDARD", active: true },
  { label: "NV", active: false },
  { label: "FLIR", active: false },
  { label: "CRT", active: false },
];

export default function GlobeSidebar({ onBuildingSelect }: GlobeSidebarProps) {
  const [activeMode, setActiveMode] = useState("STANDARD");
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);

  return (
    <div
      className="absolute left-0 top-0 bottom-0 pointer-events-auto"
      style={{
        width: "240px",
        backgroundColor: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(12px)",
        borderRight: "1px solid rgba(0, 229, 255, 0.2)",
        zIndex: 20,
        fontFamily: "var(--font-mono)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Corner decorations */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          width: "12px",
          height: "12px",
          borderTop: "1px solid rgba(0, 229, 255, 0.5)",
          borderLeft: "1px solid rgba(0, 229, 255, 0.5)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          width: "12px",
          height: "12px",
          borderTop: "1px solid rgba(0, 229, 255, 0.5)",
          borderRight: "1px solid rgba(0, 229, 255, 0.5)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: "8px",
          left: "8px",
          width: "12px",
          height: "12px",
          borderBottom: "1px solid rgba(0, 229, 255, 0.5)",
          borderLeft: "1px solid rgba(0, 229, 255, 0.5)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          width: "12px",
          height: "12px",
          borderBottom: "1px solid rgba(0, 229, 255, 0.5)",
          borderRight: "1px solid rgba(0, 229, 255, 0.5)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid rgba(0, 229, 255, 0.1)",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "0.35em",
            color: "var(--color-text-dim)",
            textTransform: "uppercase",
          }}
        >
          SURVEILLANCE OPS
        </span>
      </div>

      {/* Vision Modes section */}
      <div style={{ padding: "16px" }}>
        <p
          style={{
            fontSize: "9px",
            letterSpacing: "0.3em",
            color: "rgba(0, 229, 255, 0.5)",
            textTransform: "uppercase",
            marginBottom: "10px",
          }}
        >
          [ VISION MODES ]
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          {VISION_MODES.map((mode) => {
            const isActive = activeMode === mode.label;
            return (
              <button
                key={mode.label}
                onClick={() => setActiveMode(mode.label)}
                style={{
                  padding: "7px 4px",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  backgroundColor: isActive
                    ? "rgba(0, 229, 255, 0.07)"
                    : "rgba(255,255,255,0.02)",
                  border: isActive
                    ? "1px solid rgba(0, 229, 255, 0.6)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: isActive
                    ? "var(--color-accent-cyan)"
                    : "var(--color-text-dim)",
                  boxShadow: isActive
                    ? "0 0 8px rgba(0, 229, 255, 0.25), inset 0 0 6px rgba(0, 229, 255, 0.05)"
                    : "none",
                  transition: "all 120ms ease",
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          margin: "0 16px",
          background:
            "linear-gradient(90deg, transparent, rgba(0,229,255,0.15), transparent)",
        }}
      />

      {/* Target Buildings section */}
      <div style={{ padding: "16px", flex: 1 }}>
        <p
          style={{
            fontSize: "9px",
            letterSpacing: "0.3em",
            color: "rgba(0, 229, 255, 0.5)",
            textTransform: "uppercase",
            marginBottom: "10px",
          }}
        >
          [ TARGET BUILDINGS ]
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {PRELOADED_BUILDINGS.map((building, idx) => {
            const isHovered = hoveredBuilding === building.id;
            return (
              <button
                key={building.id}
                onClick={() => onBuildingSelect(building)}
                onMouseEnter={() => setHoveredBuilding(building.id)}
                onMouseLeave={() => setHoveredBuilding(null)}
                style={{
                  textAlign: "left",
                  padding: "10px 10px",
                  backgroundColor: isHovered
                    ? "rgba(0, 229, 255, 0.06)"
                    : "rgba(255,255,255,0.02)",
                  border: isHovered
                    ? "1px solid rgba(0, 229, 255, 0.35)"
                    : "1px solid rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  boxShadow: isHovered
                    ? "0 0 10px rgba(0, 229, 255, 0.15)"
                    : "none",
                  transition: "all 120ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "9px",
                      color: "rgba(0, 229, 255, 0.4)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.05em",
                      color: isHovered
                        ? "var(--color-accent-cyan)"
                        : "var(--color-text)",
                      lineHeight: 1.3,
                      textTransform: "uppercase",
                    }}
                    className={isHovered ? "glow-cyan" : ""}
                  >
                    {building.name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: "var(--color-text-dim)",
                    letterSpacing: "0.05em",
                    paddingLeft: "18px",
                  }}
                >
                  {building.lat.toFixed(4)}N, {Math.abs(building.lng).toFixed(4)}W
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer status */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(0, 229, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          className="hud-pulse"
          style={{
            fontSize: "8px",
            color: "var(--color-accent-green)",
          }}
        >
          ●
        </span>
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "0.2em",
            color: "var(--color-text-dim)",
            textTransform: "uppercase",
          }}
        >
          FEED ACTIVE
        </span>
      </div>
    </div>
  );
}
