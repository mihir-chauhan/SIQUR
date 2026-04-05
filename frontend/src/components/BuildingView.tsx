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
} from "@/lib/types";
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
  const [cameraCount, setCameraCount] = useState<number>(4);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placementDone, setPlacementDone] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load session + building + existing cameras on mount ──────────────────
  useEffect(() => {
    const sid = getSessionId();
    if (!sid) {
      // No session — try localStorage fallback before giving up
      const storedId = getSelectedBuilding();
      const fallback = storedId
        ? PRELOADED_BUILDINGS.find((b) => b.id === storedId) ?? null
        : null;
      if (fallback) {
        setBuilding(fallback);
      }
      // Don't redirect — BuildingView may be embedded in a page that works without a session
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
          // Don't redirect — just leave building as null; the host page handles navigation
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
        backgroundColor: "transparent",
        color: "var(--color-text)",
        display: "flex",
        flexDirection: "column",
        padding: "12px",
        gap: "12px",
        position: "relative",
      }}
    >
      {/* ── Stacked layout for sidebar ────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Floor plan */}
        <div
          style={{
            position: "relative",
            borderBottom: "1px solid rgba(0, 229, 255, 0.08)",
            paddingBottom: "12px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "9px",
              letterSpacing: "0.35em",
              color: "var(--color-accent-cyan)",
              opacity: 0.6,
              marginBottom: "8px",
            }}
          >
            FLOOR PLAN
          </p>

          {/* Floor plan image — inverted + cyan tinted for dark theme */}
          <div style={{ width: "100%", position: "relative" }}>
            <img
              src="/models/DSAI_floorplan.png"
              alt={`Floor plan of Hall of Data Science and AI`}
              style={{
                width: "100%",
                display: "block",
                opacity: 0.9,
                filter: "invert(1) sepia(1) saturate(4) hue-rotate(160deg)",
              }}
            />
          </div>
        </div>

        {/* Camera deployment controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Train camera models button */}
          <button
            onClick={() => { window.location.href = "/v2/training"; }}
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "#00e5ff",
              background: "rgba(0, 229, 255, 0.08)",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              borderRadius: "4px",
              padding: "14px",
              cursor: "pointer",
              transition: "all 200ms ease",
              width: "100%",
              textTransform: "uppercase" as const,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 229, 255, 0.15)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0, 229, 255, 0.6)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 229, 255, 0.08)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0, 229, 255, 0.3)";
            }}
          >
            TRAIN CAMERA MODELS
          </button>

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

    </main>
  );
}
