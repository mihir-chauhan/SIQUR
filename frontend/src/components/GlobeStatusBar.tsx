"use client";

import { useEffect, useState } from "react";
import { PRELOADED_BUILDINGS } from "@/lib/buildings";

export default function GlobeStatusBar() {
  const [dataAge, setDataAge] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDataAge((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatAge = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  return (
    <div
      className="absolute left-0 right-0 bottom-0 pointer-events-none"
      style={{
        height: "36px",
        backgroundColor: "rgba(10,10,10,0.9)",
        borderTop: "1px solid rgba(0, 229, 255, 0.2)",
        zIndex: 20,
        fontFamily: "var(--font-mono)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
      }}
    >
      {/* Left: Branding */}
      <span
        className="glow-cyan"
        style={{
          fontSize: "11px",
          letterSpacing: "0.35em",
          color: "var(--color-accent-cyan)",
          textTransform: "uppercase",
        }}
      >
        MINORITY REPORT
      </span>

      {/* Center: Stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "10px",
          letterSpacing: "0.2em",
          color: "var(--color-text-dim)",
          textTransform: "uppercase",
        }}
      >
        <span>
          <span style={{ color: "var(--color-accent-cyan)", opacity: 0.7 }}>
            {PRELOADED_BUILDINGS.length}
          </span>{" "}
          TARGETS
        </span>
        <span style={{ color: "rgba(0,229,255,0.2)" }}>|</span>
        <span>
          <span style={{ color: "var(--color-accent-cyan)", opacity: 0.7 }}>0</span>{" "}
          CAMERAS
        </span>
        <span style={{ color: "rgba(0,229,255,0.2)" }}>|</span>
        <span>
          <span style={{ color: "var(--color-accent-cyan)", opacity: 0.7 }}>0</span>{" "}
          SIMULATIONS
        </span>
      </div>

      {/* Right: Live indicator + data age */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "10px",
          letterSpacing: "0.2em",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            color: "var(--color-accent-green)",
          }}
        >
          <span className="hud-pulse" style={{ fontSize: "8px" }}>●</span>
          <span className="glow-green" style={{ letterSpacing: "0.3em" }}>
            LIVE
          </span>
        </span>
        <span style={{ color: "var(--color-text-dim)" }}>
          DATA AGE: {formatAge(dataAge)}
        </span>
      </div>
    </div>
  );
}
