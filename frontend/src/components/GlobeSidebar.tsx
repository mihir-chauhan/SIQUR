"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PRELOADED_BUILDINGS } from "@/lib/buildings";
import type { Building } from "@/lib/types";

interface GlobeSidebarProps {
  onBuildingSelect: (building: Building) => void;
}

const VISION_MODES = ["STANDARD", "NV", "FLIR", "CRT"] as const;

export default function GlobeSidebar({ onBuildingSelect }: GlobeSidebarProps) {
  const [activeMode, setActiveMode] = useState<string>("STANDARD");
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);

  return (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="glass-panel"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: "240px",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-mono)",
        borderRight: "1px solid rgba(0, 229, 255, 0.1)",
        borderLeft: "none",
        borderTop: "none",
        borderBottom: "none",
        overflow: "hidden",
      }}
    >
      {/* Scanner line sweep */}
      <div
        className="scanner-line"
        style={{ top: "50%", left: 0, opacity: 0.3 }}
      />

      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid rgba(0, 229, 255, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            letterSpacing: "0.35em",
            color: "var(--color-accent-cyan)",
            fontWeight: 700,
          }}
        >
          SURVEILLANCE OPS
        </div>
        <div
          style={{
            fontSize: "8px",
            letterSpacing: "0.2em",
            color: "var(--color-text-dim)",
            marginTop: "4px",
          }}
        >
          COMMAND INTERFACE v2.1
        </div>
      </div>

      {/* Vision Modes */}
      <div style={{ padding: "12px 16px" }}>
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "var(--color-accent-cyan)",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: "4px",
              height: "4px",
              backgroundColor: "var(--color-accent-cyan)",
              display: "inline-block",
            }}
          />
          VISION MODES
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px",
          }}
        >
          {VISION_MODES.map((mode) => {
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveMode(mode)}
                className="hud-button"
                style={{
                  position: "relative",
                  padding: "6px 0",
                  fontSize: "9px",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.15em",
                  textAlign: "center",
                  cursor: "pointer",
                  color: isActive
                    ? "var(--color-accent-cyan)"
                    : "var(--color-text-dim)",
                  backgroundColor: isActive
                    ? "rgba(0, 229, 255, 0.08)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(0, 229, 255, 0.3)"
                    : "1px solid rgba(0, 229, 255, 0.06)",
                  borderRadius: "1px",
                  transition: "all 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                  overflow: "hidden",
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="vision-mode-indicator"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "10%",
                      right: "10%",
                      height: "1px",
                      background:
                        "linear-gradient(90deg, transparent, var(--color-accent-cyan), transparent)",
                      boxShadow: "0 0 6px rgba(0, 229, 255, 0.5)",
                    }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      {/* Separator with animated gradient */}
      <div
        style={{
          height: "1px",
          margin: "0 16px",
          background:
            "linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.15), transparent)",
        }}
      />

      {/* Target Buildings */}
      <div
        style={{
          padding: "12px 16px 8px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "var(--color-accent-cyan)",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: "4px",
              height: "4px",
              backgroundColor: "var(--color-accent-cyan)",
              display: "inline-block",
            }}
          />
          TARGET BUILDINGS
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            position: "relative",
          }}
        >
          {PRELOADED_BUILDINGS.map((building, idx) => {
            const isHovered = hoveredBuilding === building.id;
            return (
              <motion.button
                key={building.id}
                type="button"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.35,
                  delay: 0.15 + idx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onClick={() => onBuildingSelect(building)}
                onMouseEnter={() => setHoveredBuilding(building.id)}
                onMouseLeave={() => setHoveredBuilding(null)}
                className="hud-button"
                style={{
                  position: "relative",
                  display: "block",
                  textAlign: "left",
                  width: "100%",
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  backgroundColor: isHovered
                    ? "rgba(0, 229, 255, 0.04)"
                    : "transparent",
                  border: "1px solid",
                  borderColor: isHovered
                    ? "rgba(0, 229, 255, 0.15)"
                    : "transparent",
                  borderRadius: "1px",
                  transition: "all 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                  overflow: "hidden",
                }}
              >
                {/* Scanner sweep on hover */}
                {isHovered && (
                  <motion.span
                    initial={{ left: "-100%" }}
                    animate={{ left: "200%" }}
                    transition={{ duration: 0.8, ease: "linear" }}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      width: "50%",
                      background:
                        "linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.06), transparent)",
                      pointerEvents: "none",
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "8px",
                      color: "var(--color-text-dim)",
                      marginTop: "2px",
                      opacity: 0.5,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.1em",
                        color: isHovered
                          ? "var(--color-accent-cyan)"
                          : "var(--color-text)",
                        fontWeight: isHovered ? 700 : 400,
                        transition: "color 200ms, font-weight 200ms",
                        textTransform: "uppercase",
                      }}
                    >
                      {building.name}
                    </div>
                    <div
                      style={{
                        fontSize: "8px",
                        letterSpacing: "0.08em",
                        color: "var(--color-text-dim)",
                        marginTop: "3px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {building.lat.toFixed(4)}N, {building.lng.toFixed(4)}W
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Scroll fade indicator */}
        <div
          aria-hidden
          style={{
            height: "24px",
            background:
              "linear-gradient(to top, rgba(10, 10, 10, 0.9), transparent)",
            marginTop: "-24px",
            position: "relative",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Footer status */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(0, 229, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "8px",
          letterSpacing: "0.15em",
          color: "var(--color-text-dim)",
        }}
      >
        <span className="hud-pulse" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent-green)",
              boxShadow: "0 0 6px rgba(0, 255, 65, 0.6)",
              display: "inline-block",
            }}
          />
          SYSTEM ACTIVE
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {PRELOADED_BUILDINGS.length} TARGETS
        </span>
      </div>
    </motion.aside>
  );
}
