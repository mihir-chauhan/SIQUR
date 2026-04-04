"use client";

import { useEffect, useReducer, useRef, useCallback } from "react";
import type {
  WatchmanCamera,
  WatchmanIncident,
  WatchmanDispatchEntry,
  WatchmanQueryEntry,
} from "@/lib/watchman-types";
import { connectWatchmanWs } from "@/lib/watchman-api";
import CameraGrid from "./CameraGrid";
import DispatchLog from "./DispatchLog";
import QueryBar from "./QueryBar";

// ── State & reducer ──────────────────────────────────────────────────────────

interface WatchmanState {
  cameras: WatchmanCamera[];
  dispatch: WatchmanDispatchEntry[];
  queries: WatchmanQueryEntry[];
  connected: boolean;
  hasIncidentHistory: boolean;
}

type WatchmanAction =
  | {
      type: "snapshot";
      cameras: WatchmanCamera[];
      incidents: WatchmanIncident[];
      dispatch: WatchmanDispatchEntry[];
    }
  | { type: "camera_ok"; cameraId: string; analyzedAt: number }
  | {
      type: "incident_detected";
      camera: WatchmanCamera;
      dispatch: WatchmanDispatchEntry;
    }
  | {
      type: "incident_resolved";
      cameraId: string;
      incidentId: string;
      resolvedAt: number;
    }
  | { type: "connection"; connected: boolean }
  | { type: "add_query"; entry: WatchmanQueryEntry };

function reducer(state: WatchmanState, action: WatchmanAction): WatchmanState {
  switch (action.type) {
    case "snapshot":
      return {
        ...state,
        cameras: action.cameras,
        dispatch: action.dispatch,
        hasIncidentHistory:
          action.incidents.length > 0 || action.dispatch.length > 0,
      };
    case "camera_ok":
      return {
        ...state,
        cameras: state.cameras.map((c) =>
          c.id === action.cameraId ? { ...c, lastAnalyzed: action.analyzedAt } : c
        ),
      };
    case "incident_detected":
      return {
        ...state,
        cameras: state.cameras.map((c) =>
          c.id === action.camera.id ? action.camera : c
        ),
        dispatch: [action.dispatch, ...state.dispatch].slice(0, 100),
        hasIncidentHistory: true,
      };
    case "incident_resolved":
      return {
        ...state,
        cameras: state.cameras.map((c) =>
          c.id === action.cameraId
            ? { ...c, status: "nominal", currentIncident: null, lastAnalyzed: action.resolvedAt }
            : c
        ),
      };
    case "connection":
      return { ...state, connected: action.connected };
    case "add_query":
      return {
        ...state,
        queries: [action.entry, ...state.queries].slice(0, 20),
      };
    default:
      return state;
  }
}

const initial: WatchmanState = {
  cameras: [],
  dispatch: [],
  queries: [],
  connected: false,
  hasIncidentHistory: false,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function WatchmanView() {
  const [state, dispatch] = useReducer(reducer, initial);
  const disconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const disconnect = connectWatchmanWs({
      onSnapshot: (cameras, incidents, dispatchLog) =>
        dispatch({ type: "snapshot", cameras, incidents, dispatch: dispatchLog }),
      onCameraOk: (cameraId, analyzedAt) =>
        dispatch({ type: "camera_ok", cameraId, analyzedAt }),
      onIncidentDetected: (camera, _incident, entry) =>
        dispatch({ type: "incident_detected", camera, dispatch: entry }),
      onIncidentResolved: (cameraId, incidentId, resolvedAt) =>
        dispatch({ type: "incident_resolved", cameraId, incidentId, resolvedAt }),
      onConnectionChange: (connected) =>
        dispatch({ type: "connection", connected }),
    });
    disconnectRef.current = disconnect;
    return disconnect;
  }, []);

  const handleNewQuery = useCallback((entry: WatchmanQueryEntry) => {
    dispatch({ type: "add_query", entry });
  }, []);

  const incidentCount = state.cameras.filter((c) => c.status === "incident").length;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
      }}
    >
      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
          gap: 16,
        }}
      >
        {/* Left: title */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
          <span
            className="breathing-glow"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-accent-cyan)",
              letterSpacing: "0.15em",
            }}
          >
            WATCHMAN
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-dim)",
              letterSpacing: "0.08em",
            }}
          >
            // AI SECURITY MONITOR
          </span>
        </div>

        {/* Center: alert count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: incidentCount > 0 ? "var(--color-accent-red)" : "var(--color-text-dim)",
            padding: "4px 12px",
            borderRadius: 4,
            border: incidentCount > 0 ? "1px solid rgba(255,45,45,0.3)" : "1px solid transparent",
            background: incidentCount > 0 ? "rgba(255,45,45,0.06)" : "transparent",
            transition: "all 0.3s ease",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: incidentCount > 0 ? "var(--color-accent-red)" : "var(--color-text-dim)",
              boxShadow: incidentCount > 0 ? "0 0 6px rgba(255,45,45,0.8)" : undefined,
              display: "inline-block",
              animation: incidentCount > 0 ? "rec-blink 0.8s step-start infinite" : undefined,
              flexShrink: 0,
            }}
          />
          <span>{incidentCount}</span>
          <span style={{ fontSize: 10, opacity: 0.8, letterSpacing: "0.06em" }}>
            {incidentCount === 1 ? "ACTIVE ALERT" : "ACTIVE ALERTS"}
          </span>
        </div>

        {/* Right: meta */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexShrink: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ color: "var(--color-text-dim)" }}>CAMERAS</span>
            <span style={{ color: "var(--color-text)" }}>{state.cameras.length}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: state.connected ? "var(--color-accent-green)" : "var(--color-text-dim)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: state.connected ? "var(--color-accent-green)" : "var(--color-text-dim)",
                boxShadow: state.connected ? "0 0 5px rgba(0,255,65,0.7)" : undefined,
                display: "inline-block",
              }}
            />
            <span>{state.connected ? "CONNECTED" : "RECONNECTING"}</span>
          </div>
        </div>
      </div>

      {/* ── Main body ──────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Camera grid */}
        <div style={{ flex: 1, padding: 12, overflow: "hidden" }}>
          <CameraGrid cameras={state.cameras} />
        </div>

        {/* Right panel: Dispatch log */}
        <div
          style={{
            width: 300,
            minWidth: 260,
            borderLeft: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <DispatchLog entries={state.dispatch} />
        </div>
      </div>

      {/* ── Query bar — full width at bottom ───────────────────────── */}
      <QueryBar
        queryHistory={state.queries}
        onNewEntry={handleNewQuery}
        hasIncidentHistory={state.hasIncidentHistory}
      />
    </div>
  );
}
