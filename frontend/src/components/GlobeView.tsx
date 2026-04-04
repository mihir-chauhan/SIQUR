"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PRELOADED_BUILDINGS } from "@/lib/buildings";
import { createSession, setBuilding } from "@/lib/api";
import { setSessionId } from "@/lib/session";
import type { Building } from "@/lib/types";

interface CursorCoords {
  lat: string;
  lng: string;
  alt: string;
}

export default function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selectingBuilding, setSelectingBuilding] = useState<string | null>(
    null
  );
  const [coords, setCoords] = useState<CursorCoords>({
    lat: "40.4274",
    lng: "-86.9167",
    alt: "800",
  });

  const handleBuildingSelect = useCallback(
    async (building: Building) => {
      if (selectingBuilding) return;
      setSelectingBuilding(building.id);

      try {
        const session = await createSession();
        setSessionId(session.session_id);

        await setBuilding(session.session_id, {
          building_id: building.id,
          name: building.name,
          lat: building.lat,
          lng: building.lng,
          footprint_polygon: building.footprint_polygon,
        });

        router.push("/building");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(`BACKEND OFFLINE: ${message}`);
        setSelectingBuilding(null);
      }
    },
    [selectingBuilding, router]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: { destroy: () => void } | null = null;
    let destroyed = false;

    async function initCesium() {
      try {
        const Cesium = await import("cesium");

        // Set the base URL for Cesium assets
        (window as unknown as Record<string, unknown>).CESIUM_BASE_URL = "/cesium";

        const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (ionToken) {
          Cesium.Ion.defaultAccessToken = ionToken;
        }

        if (destroyed || !containerRef.current) return;

        // Create the viewer with minimal UI
        const v = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          creditContainer: document.createElement("div"),
          msaaSamples: 1,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          skyBox: false,
          skyAtmosphere: false,
          contextOptions: {
            webgl: {
              alpha: false,
            },
          },
        });

        viewer = v;
        viewerRef.current = v;

        // If no Ion token, fall back to OpenStreetMap imagery
        if (!ionToken) {
          v.imageryLayers.removeAll();
          v.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/'
            })
          );
        }

        // Dark globe styling
        v.scene.backgroundColor = Cesium.Color.fromCssColorString("#0a0a0a");
        v.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0d1117");
        v.scene.fog.enabled = false;
        v.scene.globe.showGroundAtmosphere = false;
        v.scene.globe.enableLighting = false;

        // Remove default sun/moon
        if (v.scene.sun) v.scene.sun.show = false;
        if (v.scene.moon) v.scene.moon.show = false;

        // Fly to Purdue campus
        v.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(-86.9167, 40.4274, 2000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 0,
        });

        // Add building markers
        for (const building of PRELOADED_BUILDINGS) {
          const position = Cesium.Cartesian3.fromDegrees(
            building.lng,
            building.lat,
            0
          );

          // Pin entity
          v.entities.add({
            id: building.id,
            name: building.name,
            position,
            point: {
              pixelSize: 14,
              color: Cesium.Color.fromCssColorString("#00e5ff"),
              outlineColor: Cesium.Color.fromCssColorString("#00e5ff")
                .withAlpha(0.3),
              outlineWidth: 8,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            label: {
              text: building.name.toUpperCase(),
              font: "13px 'Space Mono', monospace",
              fillColor: Cesium.Color.fromCssColorString("#00e5ff"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -24),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          });

          // Pulsing ring
          v.entities.add({
            position,
            ellipse: {
              semiMajorAxis: 40,
              semiMinorAxis: 40,
              material: Cesium.Color.fromCssColorString("#00e5ff").withAlpha(
                0.08
              ),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString("#00e5ff").withAlpha(
                0.3
              ),
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          });
        }

        // Click handler
        const handler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas);

        handler.setInputAction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (click: any) => {
            const picked = v.scene.pick(click.position);
            if (Cesium.defined(picked) && picked.id && picked.id.id) {
              const building = PRELOADED_BUILDINGS.find(
                (b: Building) => b.id === picked.id.id
              );
              if (building) {
                handleBuildingSelect(building);
              }
            }
          },
          Cesium.ScreenSpaceEventType.LEFT_CLICK
        );

        // Hover handler
        handler.setInputAction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (movement: any) => {
            const picked = v.scene.pick(movement.endPosition);
            if (Cesium.defined(picked) && picked.id && picked.id.id) {
              const building = PRELOADED_BUILDINGS.find(
                (b: Building) => b.id === picked.id.id
              );
              if (building) {
                setHoveredBuilding(building.id);
                containerRef.current!.style.cursor = "pointer";
              } else {
                setHoveredBuilding(null);
                containerRef.current!.style.cursor = "default";
              }
            } else {
              setHoveredBuilding(null);
              containerRef.current!.style.cursor = "default";
            }
          },
          Cesium.ScreenSpaceEventType.MOUSE_MOVE
        );

        // Track camera position for coordinates readout
        v.camera.changed.addEventListener(() => {
          const cartographic = v.camera.positionCartographic;
          setCoords({
            lat: Cesium.Math.toDegrees(cartographic.latitude).toFixed(4),
            lng: Cesium.Math.toDegrees(cartographic.longitude).toFixed(4),
            alt: (cartographic.height / 1000).toFixed(1),
          });
        });

        setReady(true);
      } catch (err: unknown) {
        if (!destroyed) {
          const message =
            err instanceof Error ? err.message : "Failed to initialize globe";
          setError(message);
        }
      }
    }

    initCesium();

    return () => {
      destroyed = true;
      if (viewer) {
        try {
          viewer.destroy();
        } catch {
          // Cesium may throw during cleanup
        }
      }
    };
  }, [handleBuildingSelect]);

  const hoveredBuildingData = PRELOADED_BUILDINGS.find(
    (b) => b.id === hoveredBuilding
  );

  return (
    <div
      className="relative w-full h-full"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Cesium container */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ backgroundColor: "#0a0a0a" }}
      />

      {/* HUD Overlay Elements */}
      <AnimatePresence>
        {ready && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            className="pointer-events-none absolute inset-0"
          >
            {/* TOP SECRET Banner */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-center py-2"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
              }}
            >
              <span
                className="glow-cyan font-mono text-xs tracking-[0.5em] uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent-cyan)",
                }}
              >
                TOP SECRET // SCI // MINORITY REPORT SYSTEM
              </span>
            </div>

            {/* Corner brackets */}
            <span
              aria-hidden
              className="absolute top-10 left-6 h-8 w-8 border-t-2 border-l-2"
              style={{
                borderColor: "var(--color-accent-cyan)",
                opacity: 0.4,
              }}
            />
            <span
              aria-hidden
              className="absolute top-10 right-6 h-8 w-8 border-t-2 border-r-2"
              style={{
                borderColor: "var(--color-accent-cyan)",
                opacity: 0.4,
              }}
            />
            <span
              aria-hidden
              className="absolute bottom-10 left-6 h-8 w-8 border-b-2 border-l-2"
              style={{
                borderColor: "var(--color-accent-cyan)",
                opacity: 0.4,
              }}
            />
            <span
              aria-hidden
              className="absolute bottom-10 right-6 h-8 w-8 border-b-2 border-r-2"
              style={{
                borderColor: "var(--color-accent-cyan)",
                opacity: 0.4,
              }}
            />

            {/* System status (top left) */}
            <div
              className="absolute top-12 left-10 flex flex-col gap-1 font-mono text-xs"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span
                className="hud-pulse"
                style={{ color: "var(--color-accent-green)" }}
              >
                ● SATELLITE LINK ACTIVE
              </span>
              <span style={{ color: "var(--color-text-dim)" }}>
                FEED: PURDUE UNIVERSITY
              </span>
              <span style={{ color: "var(--color-text-dim)" }}>
                RESOLUTION: 0.3m/px
              </span>
            </div>

            {/* Mission clock (top right) */}
            <div
              className="absolute top-12 right-10 flex flex-col items-end gap-1 font-mono text-xs"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <MissionClock />
              <span style={{ color: "var(--color-text-dim)" }}>
                CLASSIFICATION: EYES ONLY
              </span>
            </div>

            {/* Building selector hint */}
            <div
              className="absolute left-1/2 -translate-x-1/2 font-mono text-xs"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-accent-cyan)",
                opacity: 0.7,
                bottom: "5rem",
              }}
            >
              SELECT TARGET BUILDING TO PROCEED
            </div>

            {/* Coordinates readout (bottom) */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6 font-mono text-xs tracking-widest"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-dim)",
              }}
            >
              <span>LAT {coords.lat}&#176; N</span>
              <span
                style={{ color: "var(--color-accent-cyan)", opacity: 0.3 }}
              >
                |
              </span>
              <span>LON {coords.lng}&#176; W</span>
              <span
                style={{ color: "var(--color-accent-cyan)", opacity: 0.3 }}
              >
                |
              </span>
              <span>ALT {coords.alt} KM</span>
            </div>

            {/* Building count */}
            <div
              className="absolute bottom-4 right-10 font-mono text-xs"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-dim)",
              }}
            >
              TARGETS: {PRELOADED_BUILDINGS.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hovered building tooltip */}
      <AnimatePresence>
        {hoveredBuildingData && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 glow-cyan-box px-4 py-2 font-mono text-xs"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent-cyan)",
              backgroundColor: "rgba(10, 10, 10, 0.9)",
              border: "1px solid rgba(0, 229, 255, 0.2)",
            }}
          >
            <span className="glow-cyan">
              TARGET: {hoveredBuildingData.name.toUpperCase()}
            </span>
            <span
              className="block mt-1"
              style={{ color: "var(--color-text-dim)" }}
            >
              {hoveredBuildingData.lat.toFixed(4)}&#176;N,{" "}
              {hoveredBuildingData.lng.toFixed(4)}&#176;W | CLICK TO SELECT
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selecting overlay */}
      <AnimatePresence>
        {selectingBuilding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", zIndex: 50 }}
          >
            <div
              className="glow-cyan-box px-8 py-4 font-mono text-sm text-center"
              style={{
                fontFamily: "var(--font-mono)",
                backgroundColor: "rgba(10, 10, 10, 0.95)",
                border: "1px solid rgba(0, 229, 255, 0.3)",
              }}
            >
              <span
                className="glow-cyan cursor-blink"
                style={{ color: "var(--color-accent-cyan)" }}
              >
                ESTABLISHING SECURE LINK
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error overlay */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.7)", zIndex: 60 }}
          >
            <div
              className="glow-cyan-box px-8 py-6 font-mono text-sm text-center max-w-md"
              style={{
                fontFamily: "var(--font-mono)",
                backgroundColor: "rgba(10, 10, 10, 0.95)",
                border: "1px solid rgba(255, 60, 60, 0.4)",
              }}
            >
              <span
                className="block text-xs tracking-[0.3em] mb-2"
                style={{ color: "#ff3c3c" }}
              >
                &#9888; SYSTEM ERROR
              </span>
              <span style={{ color: "var(--color-text)" }}>{error}</span>
              <button
                onClick={() => setError(null)}
                className="block mx-auto mt-4 px-4 py-1 font-mono text-xs tracking-wider cursor-pointer"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent-cyan)",
                  border: "1px solid rgba(0, 229, 255, 0.3)",
                  backgroundColor: "transparent",
                }}
              >
                DISMISS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Live mission clock displayed in the HUD */
function MissionClock() {
  const [time, setTime] = useState(formatTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="glow-green" style={{ color: "var(--color-accent-green)" }}>
      {time} UTC
    </span>
  );
}

function formatTime(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
