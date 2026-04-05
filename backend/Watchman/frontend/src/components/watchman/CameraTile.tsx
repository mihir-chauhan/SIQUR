"use client";

import { useCallback, useEffect, useState } from "react";
import type { WatchmanCamera } from "@/lib/watchman-types";
import { resolveWatchmanIncident, triggerWatchmanAnalysis } from "@/lib/watchman-api";
import AlarmBadge from "./AlarmBadge";

interface CameraTileProps {
  camera: WatchmanCamera;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Corner bracket (one of four corners)
function Bracket({
  top,
  bottom,
  left,
  right,
  incident,
}: {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  incident: boolean;
}) {
  const color = incident ? "rgba(255,45,45,0.7)" : "rgba(0,229,255,0.4)";
  return (
    <span
      aria-hidden
      className="pointer-events-none"
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        width: 10,
        height: 10,
        borderTop: top !== undefined ? `2px solid ${color}` : undefined,
        borderBottom: bottom !== undefined ? `2px solid ${color}` : undefined,
        borderLeft: left !== undefined ? `2px solid ${color}` : undefined,
        borderRight: right !== undefined ? `2px solid ${color}` : undefined,
        zIndex: 3,
      }}
    />
  );
}

export default function CameraTile({ camera }: CameraTileProps) {
  const [now, setNow] = useState(Date.now());
  const [hovered, setHovered] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const isIncident = camera.status === "incident";

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      await triggerWatchmanAnalysis(camera.id);
    } finally {
      setTimeout(() => setAnalyzing(false), 2000);
    }
  }, [camera.id]);

  const handleResolve = useCallback(async () => {
    await resolveWatchmanIncident(camera.id);
  }, [camera.id]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        border: `1px solid ${isIncident ? "rgba(255,45,45,0.8)" : "rgba(0,229,255,0.12)"}`,
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: isIncident ? "alarm-flash 0.6s ease-in-out infinite, alarm-glow-pulse 0.6s ease-in-out infinite" : undefined,
      }}
    >
      {/* Corner brackets */}
      <Bracket top={0} left={0} incident={isIncident} />
      <Bracket top={0} right={0} incident={isIncident} />
      <Bracket bottom={0} left={0} incident={isIncident} />
      <Bracket bottom={0} right={0} incident={isIncident} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderBottom: "1px solid rgba(0,229,255,0.08)",
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: isIncident ? "var(--color-accent-red)" : "var(--color-accent-cyan)",
          }}
        >
          {camera.id}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-dim)",
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {camera.label}
        </span>
        {/* REC indicator */}
        <span
          className="rec-blink"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#ff2d2d",
            boxShadow: "0 0 5px rgba(255,45,45,0.8)",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#ff2d2d",
            textShadow: "0 0 6px rgba(255,45,45,0.5)",
          }}
        >
          REC
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {isIncident && camera.currentIncident ? (
          <AlarmBadge incident={camera.currentIncident} />
        ) : (
          <>
            {/* Camera icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              aria-hidden
              style={{
                width: 44,
                height: 44,
                color: "rgba(0,229,255,0.12)",
              }}
            >
              <path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1" />
              <rect x="3" y="7" width="12" height="10" rx="2" />
              <circle cx="10" cy="12" r="2" />
            </svg>
            {/* Scanner line — nominal atmosphere */}
            <div className="scanner-line" style={{ top: "50%" }} />
            {/* Live dot */}
            <div
              style={{
                position: "absolute",
                bottom: 8,
                right: 10,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--color-accent-green)",
                  boxShadow: "0 0 5px rgba(0,255,65,0.7)",
                  display: "inline-block",
                  animation: "rec-blink 2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--color-accent-green)",
                  letterSpacing: "0.06em",
                }}
              >
                LIVE
              </span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 12px",
          borderTop: "1px solid rgba(0,229,255,0.08)",
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--color-text-dim)",
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginRight: 8,
          }}
        >
          {camera.location}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-dim)",
            flexShrink: 0,
          }}
        >
          {formatTime(now)}
        </span>
      </div>

      {/* Hover action button */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          {isIncident ? (
            <button
              onClick={handleResolve}
              className="hud-button"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                padding: "4px 12px",
                borderRadius: 2,
                border: "1px solid rgba(255,45,45,0.5)",
                background: "rgba(10,10,10,0.92)",
                color: "var(--color-accent-red)",
                cursor: "pointer",
              }}
            >
              CLEAR ALARM
            </button>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="hud-button"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                padding: "4px 12px",
                borderRadius: 2,
                border: "1px solid rgba(0,229,255,0.4)",
                background: "rgba(10,10,10,0.92)",
                color: analyzing ? "var(--color-text-dim)" : "var(--color-accent-cyan)",
                cursor: analyzing ? "not-allowed" : "pointer",
                opacity: analyzing ? 0.6 : 1,
              }}
            >
              {analyzing ? "ANALYZING…" : "ANALYZE NOW"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
