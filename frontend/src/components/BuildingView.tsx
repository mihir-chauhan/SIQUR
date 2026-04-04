"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSessionId, getSelectedBuilding } from "../lib/session";
import { PRELOADED_BUILDINGS } from "../lib/buildings";
import { getBuilding, getCameras, placeCameras } from "../lib/api";
import type {
  Building,
  Camera,
} from "../../../types";
import CoverageBadge from "./CoverageBadge";

// ─── SVG floor-plan helpers ───────────────────────────────────────────────────

const SVG_SIZE = 400;
const SVG_PAD = 40;

function scalePolygon(
  coords: Array<[number, number]>
): Array<[number, number]> {
  if (coords.length === 0) return [];

  const lats = coords.map(([lat]) => lat);
  const lngs = coords.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.0001;
  const lngRange = maxLng - minLng || 0.0001;

  const usable = SVG_SIZE - SVG_PAD * 2;

  return coords.map(([lat, lng]) => {
    const x = SVG_PAD + ((lng - minLng) / lngRange) * usable;
    // Flip y: higher lat → higher up on screen
    const y = SVG_PAD + ((maxLat - lat) / latRange) * usable;
    return [x, y];
  });
}

function polygonPoints(scaled: Array<[number, number]>): string {
  return scaled.map(([x, y]) => `${x},${y}`).join(" ");
}

function cameraToSVG(
  camera: Camera,
  building: Building
): { svgX: number; svgY: number } {
  // Camera position x/z are in meters relative to building centre
  // We need building bounds in metres. Use footprint lat/lng range as proxy.
  const lats = building.footprint_polygon.map(([lat]) => lat);
  const lngs = building.footprint_polygon.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Approx degree-to-metre conversion
  const latM = (maxLat - minLat) * 111_000;
  const lngM = (maxLng - minLng) * 111_000 * Math.cos((building.lat * Math.PI) / 180);

  const halfLatM = latM / 2 || 50;
  const halfLngM = lngM / 2 || 50;

  const usable = SVG_SIZE - SVG_PAD * 2;

  // camera.position.x → lng direction, camera.position.z → lat direction
  const normX = (camera.position.x + halfLngM) / (2 * halfLngM);
  const normZ = (camera.position.z + halfLatM) / (2 * halfLatM);

  const svgX = SVG_PAD + normX * usable;
  const svgY = SVG_PAD + (1 - normZ) * usable;

  return { svgX, svgY };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HudCorners() {
  const style: React.CSSProperties = {
    position: "absolute",
    width: "20px",
    height: "20px",
    borderColor: "var(--color-accent-cyan)",
    borderStyle: "solid",
    opacity: 0.5,
  };
  return (
    <>
      <span aria-hidden style={{ ...style, top: 0, left: 0, borderWidth: "2px 0 0 2px" }} />
      <span aria-hidden style={{ ...style, top: 0, right: 0, borderWidth: "2px 2px 0 0" }} />
      <span aria-hidden style={{ ...style, bottom: 0, left: 0, borderWidth: "0 0 2px 2px" }} />
      <span aria-hidden style={{ ...style, bottom: 0, right: 0, borderWidth: "0 2px 2px 0" }} />
    </>
  );
}

interface CameraPinProps {
  svgX: number;
  svgY: number;
  cameraId: string;
  index: number;
  onClick: (id: string) => void;
}

function CameraPin({ svgX, svgY, cameraId, index, onClick }: CameraPinProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Camera ${index + 1}, click to view`}
      style={{ cursor: "pointer" }}
      onClick={() => onClick(cameraId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(cameraId);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pulse ring */}
      <circle
        cx={svgX}
        cy={svgY}
        r={hovered ? 14 : 10}
        fill="none"
        stroke="var(--color-accent-cyan)"
        strokeWidth="1"
        opacity={hovered ? 0.5 : 0.25}
        style={{ transition: "r 0.15s ease, opacity 0.15s ease" }}
      />
      {/* Core dot */}
      <circle
        cx={svgX}
        cy={svgY}
        r={5}
        fill={hovered ? "var(--color-accent-cyan)" : "rgba(0,229,255,0.7)"}
        style={{
          filter: "drop-shadow(0 0 4px rgba(0,229,255,0.9))",
          transition: "fill 0.15s ease",
        }}
      />
      {/* Index label */}
      <text
        x={svgX + 9}
        y={svgY - 7}
        fill="var(--color-accent-cyan)"
        fontSize="9"
        fontFamily="var(--font-space-mono, monospace)"
        opacity={hovered ? 1 : 0.7}
      >
        CAM{index + 1}
      </text>
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BuildingView() {
  const router = useRouter();
  const [building, setBuilding] = useState<Building | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [coverageScore, setCoverageScore] = useState<number | null>(null);
  const [cameraCount, setCameraCount] = useState<number>(6);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placementDone, setPlacementDone] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load session + building + existing cameras on mount ──────────────────
  useEffect(() => {
    const sid = getSessionId();
    if (!sid) {
      router.replace("/");
      return;
    }
    setSessionId(sid);

    Promise.all([getBuilding(sid), getCameras(sid)])
      .then(([buildingRes, camerasRes]) => {
        let resolvedBuilding = buildingRes.building;

        // Fallback: if API returned null, try loading from localStorage
        if (!resolvedBuilding) {
          const storedId = getSelectedBuilding();
          if (storedId) {
            resolvedBuilding = PRELOADED_BUILDINGS.find((b) => b.id === storedId) ?? null;
          }
        }

        if (!resolvedBuilding) {
          router.replace("/");
          return;
        }
        setBuilding(resolvedBuilding);
        setCameras(camerasRes.cameras);
        if (camerasRes.placement_complete && camerasRes.cameras.length > 0) {
          setPlacementDone(true);
        }
      })
      .catch(() => {
        // Last resort fallback: try localStorage even on full network failure
        const storedId = getSelectedBuilding();
        const fallback = storedId
          ? PRELOADED_BUILDINGS.find((b) => b.id === storedId) ?? null
          : null;
        if (fallback) {
          setBuilding(fallback);
        } else {
          setLoadError("SYSTEM OFFLINE — UNABLE TO RETRIEVE BUILDING DATA");
        }
      });
  }, [router]);

  // ── Deploy cameras ────────────────────────────────────────────────────────
  const handleDeploy = useCallback(async () => {
    if (!sessionId || !building || placing) return;

    setPlacing(true);
    try {
      const res = await placeCameras(sessionId, cameraCount);
      setCameras(res.cameras);
      setCoverageScore(res.coverage_score);
      setPlacementDone(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "PLACEMENT FAILED — RETRY";
      setLoadError(message);
    } finally {
      setPlacing(false);
    }
  }, [sessionId, building, cameraCount, placing]);

  const handleCameraClick = useCallback(
    (cameraId: string) => {
      router.push(`/camera/${cameraId}`);
    },
    [router]
  );

  // ── Error / offline state ─────────────────────────────────────────────────
  if (loadError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <p
          className="glow-cyan"
          style={{
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--color-accent-cyan)",
            fontSize: "1.1rem",
            letterSpacing: "0.2em",
          }}
        >
          {loadError}
        </p>
        <button
          onClick={() => router.replace("/")}
          className="glow-cyan-box"
          style={{
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--color-accent-cyan)",
            background: "rgba(0,229,255,0.05)",
            border: "1px solid rgba(0,229,255,0.35)",
            padding: "8px 24px",
            letterSpacing: "0.2em",
            fontSize: "11px",
            cursor: "pointer",
            borderRadius: "2px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.12)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.6)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.05)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.35)";
          }}
        >
          RETURN TO GLOBE
        </button>
      </div>
    );
  }

  // ── Waiting for building data ─────────────────────────────────────────────
  if (!building) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <p
          className="hud-pulse glow-cyan"
          style={{
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--color-accent-cyan)",
            letterSpacing: "0.3em",
            fontSize: "0.85rem",
          }}
        >
          LOADING BUILDING DATA...
        </p>
      </div>
    );
  }

  const scaledPolygon = scalePolygon(building.footprint_polygon);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        gap: "24px",
        position: "relative",
      }}
    >
      {/* Page-level HUD corners */}
      <span aria-hidden style={{ position: "fixed", top: 8, left: 8, width: 28, height: 28, borderTop: "2px solid rgba(0,229,255,0.25)", borderLeft: "2px solid rgba(0,229,255,0.25)", zIndex: 10, pointerEvents: "none" }} />
      <span aria-hidden style={{ position: "fixed", top: 8, right: 8, width: 28, height: 28, borderTop: "2px solid rgba(0,229,255,0.25)", borderRight: "2px solid rgba(0,229,255,0.25)", zIndex: 10, pointerEvents: "none" }} />
      <span aria-hidden style={{ position: "fixed", bottom: 8, left: 8, width: 28, height: 28, borderBottom: "2px solid rgba(0,229,255,0.25)", borderLeft: "2px solid rgba(0,229,255,0.25)", zIndex: 10, pointerEvents: "none" }} />
      <span aria-hidden style={{ position: "fixed", bottom: 8, right: 8, width: 28, height: 28, borderBottom: "2px solid rgba(0,229,255,0.25)", borderRight: "2px solid rgba(0,229,255,0.25)", zIndex: 10, pointerEvents: "none" }} />
      {/* ── Classification banner ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "3px 0",
          marginBottom: "-16px",
          borderBottom: "1px solid rgba(0, 229, 255, 0.06)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "7px",
            letterSpacing: "0.5em",
            color: "var(--color-accent-cyan)",
            opacity: 0.35,
          }}
        >
          TOP SECRET // BUILDING ANALYSIS // MINORITY REPORT SURVEILLANCE SYSTEM
        </span>
      </div>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Left: back + classification */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--color-accent-cyan)",
              background: "transparent",
              border: "1px solid rgba(0,229,255,0.25)",
              padding: "4px 14px",
              fontSize: "10px",
              letterSpacing: "0.25em",
              cursor: "pointer",
              alignSelf: "flex-start",
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.7)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.25)";
            }}
          >
            ← BACK
          </button>

          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "9px",
              letterSpacing: "0.4em",
              color: "var(--color-accent-cyan)",
              opacity: 0.55,
              textTransform: "uppercase",
            }}
          >
            CLASSIFICATION: EYES ONLY
          </p>

          <h1
            className="glow-cyan"
            style={{
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--color-accent-cyan)",
              fontSize: "clamp(1rem, 2.5vw, 1.5rem)",
              letterSpacing: "0.12em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            BUILDING ANALYSIS
          </h1>

          <h2
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)",
              color: "var(--color-text)",
              letterSpacing: "0.08em",
              fontWeight: 400,
              maxWidth: "480px",
            }}
          >
            {building.name.toUpperCase()}
          </h2>

          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "10px",
              color: "var(--color-text-dim)",
              letterSpacing: "0.15em",
              marginTop: "4px",
            }}
          >
            <span>LAT {building.lat.toFixed(5)}°</span>
            <span>LNG {building.lng.toFixed(5)}°</span>
            {placementDone && (
              <span style={{ color: "var(--color-accent-green)" }}>
                CAMERAS DEPLOYED: {cameras.length}
              </span>
            )}
          </div>
        </div>

        {/* Right: coverage badge (shown after placement) */}
        <AnimatePresence>
          {placementDone && coverageScore !== null && (
            <motion.div
              key="badge"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <CoverageBadge score={coverageScore} />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Main content grid ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "24px",
          flex: 1,
          alignItems: "start",
        }}
      >
        {/* Floor plan SVG */}
        <div
          className="glow-cyan-box"
          style={{
            position: "relative",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            padding: "20px",
          }}
        >
          <HudCorners />

          {/* Panel label */}
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "9px",
              letterSpacing: "0.35em",
              color: "var(--color-accent-cyan)",
              opacity: 0.6,
              marginBottom: "14px",
            }}
          >
            AERIAL FOOTPRINT — TOP VIEW
          </p>

          <div style={{ width: "100%", maxWidth: `${SVG_SIZE}px` }}>
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              width="100%"
              style={{ display: "block" }}
              aria-label={`Floor plan of ${building.name}`}
            >
              {/* Grid lines for atmosphere */}
              {Array.from({ length: 9 }, (_, i) => {
                const coord = SVG_PAD + ((SVG_SIZE - SVG_PAD * 2) / 8) * i;
                return (
                  <g key={i}>
                    <line
                      x1={coord} y1={0} x2={coord} y2={SVG_SIZE}
                      stroke="rgba(0,229,255,0.05)" strokeWidth="1"
                    />
                    <line
                      x1={0} y1={coord} x2={SVG_SIZE} y2={coord}
                      stroke="rgba(0,229,255,0.05)" strokeWidth="1"
                    />
                  </g>
                );
              })}

              {/* Building footprint polygon */}
              <polygon
                points={polygonPoints(scaledPolygon)}
                fill="rgba(0,229,255,0.07)"
                stroke="var(--color-accent-cyan)"
                strokeWidth="2"
                style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.4))" }}
              />

              {/* Camera pins */}
              <AnimatePresence>
                {cameras.map((cam, i) => {
                  const { svgX, svgY } = cameraToSVG(cam, building);
                  return (
                    <motion.g
                      key={cam.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                    >
                      <CameraPin
                        svgX={svgX}
                        svgY={svgY}
                        cameraId={cam.id}
                        index={i}
                        onClick={handleCameraClick}
                      />
                    </motion.g>
                  );
                })}
              </AnimatePresence>
            </svg>
          </div>
        </div>

        {/* Right panel: camera deployment controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            minWidth: "220px",
            maxWidth: "280px",
          }}
        >
          {/* Camera budget card */}
          <div
            className="glow-cyan-box"
            style={{
              position: "relative",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <HudCorners />

            <label
              htmlFor="camera-budget"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "9px",
                letterSpacing: "0.35em",
                color: "var(--color-accent-cyan)",
                textTransform: "uppercase",
              }}
            >
              CAMERA BUDGET
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                id="camera-budget"
                ref={inputRef}
                type="number"
                min={1}
                max={50}
                value={cameraCount}
                onChange={e =>
                  setCameraCount(
                    Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1))
                  )
                }
                disabled={placing}
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: "var(--color-accent-cyan)",
                  background: "rgba(0,229,255,0.04)",
                  border: "1px solid rgba(0,229,255,0.3)",
                  borderRadius: "3px",
                  padding: "10px 12px",
                  width: "100%",
                  outline: "none",
                  textAlign: "center",
                  letterSpacing: "0.1em",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "9px",
                  color: "var(--color-text-dim)",
                  letterSpacing: "0.1em",
                }}
              >
                <span>MIN: 1</span>
                <span>MAX: 50</span>
              </div>
            </div>

            <button
              onClick={handleDeploy}
              disabled={placing}
              className="glow-cyan-box"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "11px",
                letterSpacing: "0.25em",
                color: placing ? "var(--color-text-dim)" : "var(--color-accent-cyan)",
                background: placing
                  ? "rgba(0,229,255,0.03)"
                  : "rgba(0,229,255,0.07)",
                border: placing
                  ? "1px solid rgba(0,229,255,0.1)"
                  : "1px solid rgba(0,229,255,0.35)",
                borderRadius: "3px",
                padding: "12px 16px",
                cursor: placing ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                width: "100%",
              }}
              onMouseEnter={e => {
                if (!placing) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.14)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.6)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(0,229,255,0.2)";
                }
              }}
              onMouseLeave={e => {
                if (!placing) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.07)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.35)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 1px rgba(0,229,255,0.25), 0 0 16px rgba(0,229,255,0.10)";
                }
              }}
            >
              {placing ? (
                <span className="hud-pulse">OPTIMIZING PLACEMENT...</span>
              ) : (
                "DEPLOY CAMERAS"
              )}
            </button>
          </div>

          {/* Post-placement info card */}
          <AnimatePresence>
            {placementDone && (
              <motion.div
                key="info-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="glow-green-box"
                style={{
                  position: "relative",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid rgba(0,255,65,0.2)",
                  borderRadius: "4px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <HudCorners />
                <p
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "9px",
                    letterSpacing: "0.35em",
                    color: "var(--color-accent-green)",
                    textTransform: "uppercase",
                  }}
                >
                  PLACEMENT COMPLETE
                </p>

                <div
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "11px",
                    color: "var(--color-text-dim)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    letterSpacing: "0.1em",
                  }}
                >
                  <span>
                    UNITS DEPLOYED:{" "}
                    <span style={{ color: "var(--color-text)" }}>
                      {cameras.length}
                    </span>
                  </span>
                  {coverageScore !== null && (
                    <span>
                      COVERAGE:{" "}
                      <span
                        className="glow-green"
                        style={{ color: "var(--color-accent-green)" }}
                      >
                        {Math.round(coverageScore * 100)}%
                      </span>
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "9px",
                    color: "var(--color-text-dim)",
                    letterSpacing: "0.1em",
                    marginTop: "4px",
                    opacity: 0.7,
                  }}
                >
                  SELECT A CAMERA PIN TO VIEW SIMULATION
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom status bar ─────────────────────────────────────────────────── */}
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "9px",
          color: "var(--color-text-dim)",
          letterSpacing: "0.2em",
          paddingTop: "8px",
          borderTop: "1px solid rgba(0,229,255,0.07)",
        }}
      >
        <span>MINORITY REPORT // BUILDING VIEW</span>
        <span className="hud-pulse">SURVEILLANCE ACTIVE</span>
        <span>
          {new Date().toISOString().slice(0, 19).replace("T", " ")} UTC
        </span>
      </footer>
    </main>
  );
}
