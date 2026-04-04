"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function GlobeStatusBar() {
  const [dataAge, setDataAge] = useState(0);
  const [showLive, setShowLive] = useState(true);

  // Tick data-age counter
  useEffect(() => {
    const interval = setInterval(() => {
      setDataAge((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Blink the LIVE indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setShowLive((prev) => !prev);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const formatAge = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <motion.footer
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel"
      style={{
        position: "fixed",
        bottom: 0,
        left: "240px",
        right: 0,
        height: "36px",
        zIndex: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.15em",
        color: "var(--color-text-dim)",
        borderTop: "1px solid rgba(0, 229, 255, 0.08)",
        borderLeft: "none",
        borderRight: "none",
        borderBottom: "none",
        overflow: "hidden",
      }}
    >
      {/* Scanner sweep */}
      <div
        className="scanner-line"
        style={{ top: "50%", left: 0, opacity: 0.15 }}
      />

      {/* Left: System label */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span
          className="glow-cyan"
          style={{
            color: "var(--color-accent-cyan)",
            fontWeight: 700,
            fontSize: "10px",
            letterSpacing: "0.2em",
          }}
        >
          MINORITY REPORT
        </span>
        <span style={{ color: "rgba(0, 229, 255, 0.15)" }}>│</span>
        <StatusItem label="TARGETS" value="3" />
        <StatusItem label="CAMERAS" value="0" />
        <StatusItem label="SIMULATIONS" value="0" />
      </div>

      {/* Right: Live status */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          DATA AGE: {formatAge(dataAge)}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: showLive
                ? "var(--color-accent-green)"
                : "transparent",
              boxShadow: showLive
                ? "0 0 8px rgba(0, 255, 65, 0.8)"
                : "none",
              transition: "all 150ms",
              display: "inline-block",
            }}
          />
          <span
            style={{
              color: "var(--color-accent-green)",
              fontWeight: 700,
            }}
          >
            LIVE
          </span>
        </span>
      </div>
    </motion.footer>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ color: "var(--color-text-dim)" }}>{label}</span>
      <span
        style={{
          color: "var(--color-accent-cyan)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </span>
  );
}
