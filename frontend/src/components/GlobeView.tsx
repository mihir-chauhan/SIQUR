"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PRELOADED_BUILDINGS } from "@/lib/buildings";
import { createSession, setBuilding } from "@/lib/api";
import { setSessionId, setSelectedBuilding } from "@/lib/session";
import type { Building } from "@/lib/types";
import GlobeSidebar from "@/components/GlobeSidebar";
import GlobeStatusBar from "@/components/GlobeStatusBar";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Stable reference for building select to avoid re-running the Cesium init effect
const buildingSelectRef: { current: ((b: Building) => void) | null } = {
  current: null,
};

interface CursorCoords {
  lat: string;
  lng: string;
  alt: string;
}

// ─── Boot sequence line config ──────────────────────────────────────────
interface BootLine {
  timestamp: string;
  text: string;
  type: "success" | "info" | "highlight";
}

const BOOT_LINES: Omit<BootLine, "timestamp">[] = [
  { text: "✓ satellite uplink established", type: "success" },
  { text: "✓ terrain mesh loaded", type: "success" },
  { text: "✓ building registry synced", type: "success" },
  { text: "✓ camera placement engine ready", type: "success" },
  { text: "✓ gaussian splat decoder initialized", type: "success" },
  { text: "HUD systems initializing...", type: "info" },
  { text: "Vision modes: STANDARD | NV | FLIR active", type: "highlight" },
  { text: "Connecting to surveillance feeds...", type: "info" },
  { text: "✓ System operational — 3 targets acquired", type: "success" },
];

const TITLE_TEXT = "MINORITY REPORT";

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

  // Boot sequence state
  const [bootLines, setBootLines] = useState<BootLine[]>([]);
  const [bootComplete, setBootComplete] = useState(false);
  const [userDismissed, setUserDismissed] = useState(false);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [titleRevealed, setTitleRevealed] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const introVisible = !userDismissed || !cesiumReady;

  // Animate title reveal
  useEffect(() => {
    const t = setTimeout(() => setTitleRevealed(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Boot sequence with progress
  useEffect(() => {
    const ts = () => {
      const d = new Date();
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          setBootLines((prev) => [...prev, { ...line, timestamp: ts() }]);
          setProgressPct(((i + 1) / BOOT_LINES.length) * 100);
        }, 800 + i * 350)
      );
    });
    timers.push(
      setTimeout(
        () => setBootComplete(true),
        800 + BOOT_LINES.length * 350 + 600
      )
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleBuildingSelect = useCallback(
    async (building: Building) => {
      if (selectingBuilding) return;
      setSelectingBuilding(building.id);

      try {
        const session = await createSession();
        setSessionId(session.session_id);
        setSelectedBuilding(building.id);

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

  // Keep the stable ref in sync
  buildingSelectRef.current = handleBuildingSelect;

  // ─── Cesium initialization ──────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: { destroy: () => void; isDestroyed: () => boolean } | null =
      null;
    let destroyed = false;

    async function initCesium() {
      try {
        const Cesium = await import("cesium");

        (window as unknown as Record<string, unknown>).CESIUM_BASE_URL =
          "/cesium";

        const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (ionToken) {
          Cesium.Ion.defaultAccessToken = ionToken;
        } else {
          Cesium.Ion.defaultAccessToken = undefined as unknown as string;
        }

        if (destroyed || !containerRef.current) return;

        const v = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          scene3DOnly: true,
          baseLayer: false,
          skyBox: false,
          skyAtmosphere: false,
          contextOptions: {
            webgl: {
              alpha: true,
            },
          },
          requestRenderMode: false,
          maximumRenderTimeChange: Infinity,
        });

        viewer = v;
        viewerRef.current = v;

        // Imagery layer
        if (ionToken) {
          const imageryLayer = v.imageryLayers.addImageryProvider(
            await Cesium.IonImageryProvider.fromAssetId(2)
          );
          // Darken and desaturate the satellite imagery
          imageryLayer.brightness = 0.6;
          imageryLayer.contrast = 1.15;
          imageryLayer.saturation = 0.4;
          imageryLayer.gamma = 0.85;
        } else {
          v.imageryLayers.removeAll();
          v.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              credit: new Cesium.Credit("CartoDB Dark Matter"),
              minimumLevel: 0,
              maximumLevel: 18,
            })
          );
        }

        // Darker, grayer globe styling
        v.scene.backgroundColor =
          Cesium.Color.fromCssColorString("#060608");
        v.scene.globe.baseColor =
          Cesium.Color.fromCssColorString("#0a0c10");
        v.scene.fog.enabled = false;
        v.scene.globe.showGroundAtmosphere = false;
        // Enable lighting so 3D buildings have real shadow/depth
        v.scene.globe.enableLighting = true;

        if (v.scene.sun) v.scene.sun.show = false;
        if (v.scene.moon) v.scene.moon.show = false;

        // ★ Add 3D OSM Buildings tileset for 3D building visualization
        if (ionToken) {
          try {
            const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
            v.scene.primitives.add(tileset);
            // Style: dark muted buildings that show 3D depth naturally
            // No colored overlay — just subtle gray with slight height variation
            tileset.style = new Cesium.Cesium3DTileStyle({
              color: "color('#1a1d24')",
              show: true,
            });
          } catch (e) {
            console.warn("[Globe] Could not load 3D buildings tileset:", e);
          }
        }

        // ★ START FROM FULL EARTH VIEW — way zoomed out in space
        v.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-86.9130, 40.4265, 20_000_000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        // Add building markers
        for (const building of PRELOADED_BUILDINGS) {
          const position = Cesium.Cartesian3.fromDegrees(
            building.lng,
            building.lat,
            0
          );

          v.entities.add({
            id: building.id,
            name: building.name,
            position,
            point: {
              pixelSize: 14,
              color: Cesium.Color.fromCssColorString("#00e5ff"),
              outlineColor: Cesium.Color.fromCssColorString(
                "#00e5ff"
              ).withAlpha(0.3),
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
              outlineColor: Cesium.Color.fromCssColorString(
                "#00e5ff"
              ).withAlpha(0.3),
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
              if (building && buildingSelectRef.current) {
                buildingSelectRef.current(building);
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
        setCesiumReady(true);
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
      if (viewer && !viewer.isDestroyed()) {
        try {
          viewer.destroy();
        } catch {
          // Cesium may throw during cleanup
        }
      }
    };
  }, []);

  // ─── Fly-in animation when user dismisses intro ──────────────────────
  useEffect(() => {
    if (!userDismissed || !cesiumReady || !viewerRef.current) return;

    const v = viewerRef.current as {
      camera: {
        flyTo: (opts: unknown) => void;
      };
    };

    // Import Cesium dynamically to get access to helper functions
    import("cesium").then((Cesium) => {
      v.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-86.9150, 40.4280, 1500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-75),
          roll: 0,
        },
        duration: 4.0,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    });
  }, [userDismissed, cesiumReady]);

  const hoveredBuildingData = PRELOADED_BUILDINGS.find(
    (b) => b.id === hoveredBuilding
  );

  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Cesium container */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ backgroundColor: "#0a0a0a" }}
      />

      {/* ─── Intro loading overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {introVisible && (
          <motion.div
            key="intro-overlay"
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
            style={{ backgroundColor: "#060608" }}
            onClick={() => cesiumReady && setUserDismissed(true)}
          >
            {/* Radial glow background orb */}
            <div
              style={{
                position: "absolute",
                top: "45%",
                left: "50%",
                width: "700px",
                height: "700px",
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(circle, rgba(0, 229, 255, 0.06) 0%, rgba(0, 229, 255, 0.02) 40%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Animated dot grid background */}
            <div
              className="absolute inset-0 dot-grid-animated"
              style={{ opacity: 0.25 }}
            />

            {/* Concentric targeting rings */}
            {[180, 280, 400].map((size, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: "45%",
                  left: "50%",
                  width: `${size}px`,
                  height: `${size}px`,
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  border: `1px solid rgba(0, 229, 255, ${0.08 - i * 0.02})`,
                  animation: `expand-ring ${6 + i * 2}s ease-out infinite`,
                  animationDelay: `${i * 0.5}s`,
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Corner brackets */}
            {[
              { top: 24, left: 24, bTop: true, bLeft: true },
              { top: 24, right: 24, bTop: true, bRight: true },
              { bottom: 24, left: 24, bBottom: true, bLeft: true },
              { bottom: 24, right: 24, bBottom: true, bRight: true },
            ].map((pos, i) => (
              <span
                key={i}
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  width: "36px",
                  height: "36px",
                  borderColor: "rgba(0, 229, 255, 0.25)",
                  borderStyle: "solid",
                  borderWidth: 0,
                  ...(pos.top !== undefined && { top: pos.top }),
                  ...(pos.bottom !== undefined && { bottom: pos.bottom }),
                  ...(pos.left !== undefined && { left: pos.left }),
                  ...(pos.right !== undefined && { right: pos.right }),
                  ...(pos.bTop && { borderTopWidth: "2px" }),
                  ...(pos.bBottom && { borderBottomWidth: "2px" }),
                  ...(pos.bLeft && { borderLeftWidth: "2px" }),
                  ...(pos.bRight && { borderRightWidth: "2px" }),
                }}
              />
            ))}

            {/* TOP CLASSIFICATION BAR */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                padding: "8px 0",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                letterSpacing: "0.5em",
                color: "rgba(0, 229, 255, 0.3)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.06)",
              }}
            >
              TOP SECRET // SCI // NOFORN // CATAPULT SYSTEMS
            </motion.div>

            {/* ── HERO: Giant title ────────────────────────────── */}
            <section
              className="flex flex-col items-center gap-6 relative"
              style={{ fontFamily: "var(--font-mono)", zIndex: 10 }}
            >
              {/* Small descriptor above title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: titleRevealed ? 0.4 : 0, y: titleRevealed ? 0 : 10 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.6em",
                  color: "var(--color-accent-cyan)",
                  textTransform: "uppercase",
                }}
              >
                AI SURVEILLANCE PLATFORM
              </motion.div>

              {/* MASSIVE title — the hero moment */}
              <h1
                className="font-bold tracking-[0.12em] uppercase flex flex-wrap justify-center"
                style={{
                  color: "var(--color-accent-cyan)",
                  fontSize: "clamp(3rem, 8vw, 6rem)",
                  lineHeight: 1.05,
                  textAlign: "center",
                  textShadow: "0 0 60px rgba(0, 229, 255, 0.3), 0 0 120px rgba(0, 229, 255, 0.1)",
                }}
              >
                {TITLE_TEXT.split("").map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                    animate={
                      titleRevealed
                        ? { opacity: 1, y: 0, filter: "blur(0px)" }
                        : {}
                    }
                    transition={{
                      delay: i * 0.04,
                      duration: 0.5,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      display: "inline-block",
                      minWidth: char === " " ? "0.3em" : undefined,
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                transition={{ delay: 1.0, duration: 0.6 }}
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.3em",
                  color: "#666",
                  textTransform: "uppercase",
                }}
              >
                by Catapult — Purdue University
              </motion.p>

              {/* Divider */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  width: "min(480px, 70vw)",
                  height: "1px",
                  background: "linear-gradient(90deg, transparent, var(--color-accent-cyan), transparent)",
                  opacity: 0.3,
                  transformOrigin: "center",
                }}
              />

              {/* Boot lines — compact centered block */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  fontSize: "11px",
                  width: "min(440px, 80vw)",
                  minHeight: "140px",
                }}
              >
                {bootLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "baseline",
                      color:
                        line.type === "success"
                          ? "#00ff41"
                          : line.type === "highlight"
                            ? "#00e5ff"
                            : "#444",
                    }}
                  >
                    <span style={{ color: "#2a2a2a", fontSize: "10px", flexShrink: 0 }}>
                      [{line.timestamp}]
                    </span>
                    <span>{line.text}</span>
                  </motion.div>
                ))}
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: "min(440px, 80vw)",
                  height: "2px",
                  background: "rgba(0, 229, 255, 0.06)",
                  borderRadius: "1px",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    background:
                      "linear-gradient(90deg, var(--color-accent-cyan), var(--color-accent-green))",
                    boxShadow: "0 0 10px rgba(0, 229, 255, 0.6)",
                    borderRadius: "1px",
                  }}
                />
              </div>

              {/* Click to enter */}
              <AnimatePresence>
                {bootComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center mt-2"
                  >
                    <p
                      className="tracking-[0.35em] uppercase breathing-glow"
                      style={{
                        color: "var(--color-accent-cyan)",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      [ CLICK TO ENTER ]
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sidebar + Status Bar ─────────────────────────────────────── */}
      <AnimatePresence>
        {ready && !introVisible && (
          <motion.div
            key="chrome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute inset-0"
            style={{ zIndex: 25, pointerEvents: "none" }}
          >
            <div style={{ pointerEvents: "auto" }}>
              <GlobeSidebar onBuildingSelect={handleBuildingSelect} />
            </div>
            <GlobeStatusBar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── HUD Overlay Elements ─────────────────────────────────────── */}
      <AnimatePresence>
        {ready && !introVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
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
            {[
              {
                top: "40px",
                left: "24px",
                borderWidth: "2px 0 0 2px",
              },
              {
                top: "40px",
                right: "24px",
                borderWidth: "2px 2px 0 0",
              },
              {
                bottom: "56px",
                left: "24px",
                borderWidth: "0 0 2px 2px",
              },
              {
                bottom: "56px",
                right: "24px",
                borderWidth: "0 2px 2px 0",
              },
            ].map((pos, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute"
                style={{
                  width: "28px",
                  height: "28px",
                  borderStyle: "solid",
                  borderColor: "var(--color-accent-cyan)",
                  opacity: 0.35,
                  ...pos,
                }}
              />
            ))}

            {/* System status (top left beyond sidebar) */}
            <div
              className="absolute flex flex-col gap-1 font-mono text-xs"
              style={{
                fontFamily: "var(--font-mono)",
                top: "48px",
                left: "264px",
              }}
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

            {/* Targeting Reticle — center of viewport */}
            <div
              className="absolute"
              style={{
                top: "50%",
                left: "calc(50% + 120px)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                fill="none"
                style={{ opacity: 0.2 }}
              >
                {/* Cross hairs */}
                <line
                  x1="30"
                  y1="0"
                  x2="30"
                  y2="22"
                  stroke="#00e5ff"
                  strokeWidth="0.5"
                />
                <line
                  x1="30"
                  y1="38"
                  x2="30"
                  y2="60"
                  stroke="#00e5ff"
                  strokeWidth="0.5"
                />
                <line
                  x1="0"
                  y1="30"
                  x2="22"
                  y2="30"
                  stroke="#00e5ff"
                  strokeWidth="0.5"
                />
                <line
                  x1="38"
                  y1="30"
                  x2="60"
                  y2="30"
                  stroke="#00e5ff"
                  strokeWidth="0.5"
                />
                {/* Outer circle */}
                <circle
                  cx="30"
                  cy="30"
                  r="25"
                  stroke="#00e5ff"
                  strokeWidth="0.5"
                  fill="none"
                />
                {/* Inner circle */}
                <circle
                  cx="30"
                  cy="30"
                  r="4"
                  stroke="#00e5ff"
                  strokeWidth="0.5"
                  fill="none"
                />
                {/* Tick marks */}
                <line x1="30" y1="5" x2="30" y2="9" stroke="#00e5ff" strokeWidth="1" />
                <line x1="30" y1="51" x2="30" y2="55" stroke="#00e5ff" strokeWidth="1" />
                <line x1="5" y1="30" x2="9" y2="30" stroke="#00e5ff" strokeWidth="1" />
                <line x1="51" y1="30" x2="55" y2="30" stroke="#00e5ff" strokeWidth="1" />
              </svg>
              {/* Spinning outer ring */}
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                style={{
                  position: "absolute",
                  top: "-10px",
                  left: "-10px",
                  opacity: 0.1,
                  animation: "reticle-spin 30s linear infinite",
                }}
              >
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#00e5ff"
                  strokeWidth="0.5"
                  strokeDasharray="6 10"
                  fill="none"
                />
              </svg>
            </div>

            {/* Building selector hint */}
            <div
              className="absolute left-1/2 font-mono text-xs"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-accent-cyan)",
                opacity: 0.6,
                bottom: "58px",
                transform: "translateX(calc(-50% + 120px))",
              }}
            >
              SELECT TARGET BUILDING TO PROCEED
            </div>

            {/* Coordinates readout (bottom) */}
            <div
              className="absolute bottom-4 left-1/2 flex items-center gap-6 font-mono text-xs tracking-widest"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-dim)",
                transform: "translateX(calc(-50% + 120px))",
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

      {/* ─── Hovered building tooltip ─────────────────────────────────── */}
      <AnimatePresence>
        {hoveredBuildingData && !introVisible && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute glow-cyan-box px-4 py-3 font-mono text-xs"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent-cyan)",
              backgroundColor: "rgba(10, 10, 10, 0.92)",
              border: "1px solid rgba(0, 229, 255, 0.25)",
              borderRadius: "3px",
              top: "100px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 30,
            }}
          >
            <span className="glow-cyan" style={{ letterSpacing: "0.1em" }}>
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

      {/* ─── Selecting overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectingBuilding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.7)", zIndex: 50 }}
          >
            <div
              className="glow-cyan-box px-8 py-4 font-mono text-sm text-center"
              style={{
                fontFamily: "var(--font-mono)",
                backgroundColor: "rgba(10, 10, 10, 0.95)",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                borderRadius: "3px",
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

      {/* ─── Error overlay ────────────────────────────────────────────── */}
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
                borderRadius: "3px",
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
                className="block mx-auto mt-4 px-4 py-1 font-mono text-xs tracking-wider cursor-pointer hud-button"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent-cyan)",
                  border: "1px solid rgba(0, 229, 255, 0.3)",
                  backgroundColor: "transparent",
                  borderRadius: "2px",
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
