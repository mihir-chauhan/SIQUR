"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";

const AsciiSphere = dynamic(
  () => import("@/components/ui/ascii-sphere").then((m) => m.AsciiSphere),
  { ssr: false }
);

const GlobePulse = dynamic(
  () => import("@/components/ui/cobe-globe-pulse").then((m) => m.GlobePulse),
  { ssr: false }
);

const LocationMap = dynamic(
  () => import("@/components/ui/expand-map").then((m) => m.LocationMap),
  { ssr: false }
);

const TITLE = "Watchman";
const SLOGAN = "See everything. Miss nothing.";
const TYPE_SPEED = 150;
const SLOGAN_DELAY = 400;
const BUTTON_DELAY = 600;

const BOOT_DURATION = 2000;
const BOOT_FLICKER_END = 2200;
const TYPE_START = 2400;

// Single Purdue marker
const PURDUE_MARKERS = [
  { id: "purdue", location: [40.4237, -86.9212] as [number, number], delay: 0 },
];

const LOCATION_DB: Record<string, { name: string; coordinates: string }> = {
  purdue: {
    name: "West Lafayette, IN // Purdue University",
    coordinates: "40.4237° N, 86.9212° W",
  },
};

type ViewState = "hero" | "transitioning" | "globe";

export default function V2Page() {
  // Boot
  const [bootPhase, setBootPhase] = useState<"black" | "scanning" | "flickering" | "ready">("black");
  const [scanProgress, setScanProgress] = useState(0);

  // Typewriter
  const [displayedChars, setDisplayedChars] = useState(0);
  const [sloganVisible, setSloganVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // View state
  const [view, setView] = useState<ViewState>("hero");
  const [transitionPhase, setTransitionPhase] = useState(0);
  // 0=idle, 1=text out, 2=ASCII zooms + globe fades in, 3=globe full, 4=HUD in

  // Globe
  const [globePaused, setGlobePaused] = useState(false);
  const [activeTarget, setActiveTarget] = useState<{
    id: string;
    name: string;
    coordinates: string;
    location: [number, number];
  } | null>(null);

  // ─── Boot sequence ─────────────────────────────────────────────────
  useEffect(() => {
    const startScan = setTimeout(() => {
      setBootPhase("scanning");
      const startTime = Date.now();
      scanRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / BOOT_DURATION) * 100);
        setScanProgress(progress);
        if (progress >= 100) {
          if (scanRef.current) clearInterval(scanRef.current);
          setBootPhase("flickering");
        }
      }, 16);
    }, 300);

    const settleTimer = setTimeout(() => setBootPhase("ready"), BOOT_FLICKER_END + 300);

    return () => {
      clearTimeout(startScan);
      clearTimeout(settleTimer);
      if (scanRef.current) clearInterval(scanRef.current);
    };
  }, []);

  // ─── Typewriter ────────────────────────────────────────────────────
  useEffect(() => {
    if (bootPhase !== "ready") return;
    const timeout = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDisplayedChars((prev) => {
          if (prev >= TITLE.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, TYPE_SPEED);
    }, TYPE_START - BOOT_FLICKER_END);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bootPhase]);

  useEffect(() => {
    if (displayedChars < TITLE.length) return;
    const t = setTimeout(() => setSloganVisible(true), SLOGAN_DELAY);
    return () => clearTimeout(t);
  }, [displayedChars]);

  useEffect(() => {
    if (!sloganVisible) return;
    const t = setTimeout(() => setButtonVisible(true), BUTTON_DELAY);
    return () => clearTimeout(t);
  }, [sloganVisible]);

  // ─── Transition: zoom through ──────────────────────────────────────
  const handleEnter = useCallback(() => {
    if (view !== "hero") return;
    setView("transitioning");

    // Phase 1: text lifts out
    setTransitionPhase(1);

    // Phase 2: ASCII zooms forward, globe fades in underneath
    setTimeout(() => setTransitionPhase(2), 400);

    // Phase 3: ASCII gone, globe at full size
    setTimeout(() => setTransitionPhase(3), 1400);

    // Phase 4: HUD elements appear, view switches to globe
    setTimeout(() => {
      setTransitionPhase(4);
      setView("globe");
    }, 1800);
  }, [view]);

  // ─── Globe marker click ────────────────────────────────────────────
  const handleMarkerClick = useCallback(
    (marker: { id: string; location: [number, number] }) => {
      const data = LOCATION_DB[marker.id] || { name: "Unknown", coordinates: "N/A" };
      setActiveTarget({ ...marker, ...data });
      setGlobePaused(true);
    },
    []
  );

  const titleText = TITLE.slice(0, displayedChars);
  const showCursor = displayedChars < TITLE.length && bootPhase === "ready";
  const isBooted = bootPhase === "ready" || bootPhase === "flickering";

  const showAscii = view === "hero" || (view === "transitioning" && transitionPhase < 3);
  const showGlobe = transitionPhase >= 2;
  const showHUD = transitionPhase >= 4;
  const showHeroText = view === "hero";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "#000",
        zIndex: 10000,
        overflow: "hidden",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        html, body, .scanlines, .app-shell { background: #000 !important; }

        @keyframes crt-flicker {
          0%, 100% { opacity: 0.7; }
          10% { opacity: 0.5; }
          20% { opacity: 0.8; }
          30% { opacity: 0.6; }
          50% { opacity: 0.75; }
          70% { opacity: 0.65; }
          90% { opacity: 0.7; }
        }
      `}} />

      {/* ═══ LAYER 0: ASCII sphere ═══ */}
      {showAscii && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "center center",
            clipPath: bootPhase === "scanning"
              ? `inset(0 0 ${100 - scanProgress}% 0)`
              : "inset(0 0 0 0)",
            opacity: transitionPhase >= 2 ? 0 : 0.7,
            transform: transitionPhase >= 2 ? "scale(6)" : "scale(1)",
            transition: transitionPhase >= 2
              ? "transform 1200ms cubic-bezier(0.25, 0, 0, 1), opacity 1000ms ease"
              : "none",
            animation: bootPhase === "flickering" ? "crt-flicker 0.3s ease 3" : "none",
            zIndex: 0,
          }}
        >
          <AsciiSphere />
        </div>
      )}

      {/* Scanning beam */}
      {bootPhase === "scanning" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${scanProgress}%`,
            height: "2px",
            background: "rgba(255,255,255,0.6)",
            boxShadow: "0 0 12px 3px rgba(255,255,255,0.3), 0 0 40px 8px rgba(255,255,255,0.1)",
            zIndex: 5,
          }}
        />
      )}

      {/* ═══ LAYER 1: Cobe globe (underneath ASCII, scales up) ═══ */}
      {showGlobe && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
            opacity: transitionPhase >= 3 ? 1 : 0,
            transition: "opacity 800ms ease",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "720px",
              transform: transitionPhase >= 3 ? "scale(1)" : "scale(0.4)",
              transition: "transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: 0.85,
            }}
          >
            <GlobePulse
              markers={PURDUE_MARKERS}
              onMarkerClick={handleMarkerClick}
              paused={globePaused}
            />
          </div>
        </div>
      )}

      {/* ═══ LAYER 2: Dark vignette (hero only) ═══ */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.7) 100%)",
          opacity: transitionPhase >= 2 ? 0 : 1,
          transition: "opacity 600ms ease",
          pointerEvents: "none",
        }}
      />

      {/* ═══ LAYER 3: Hero text content ═══ */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: showHeroText && isBooted ? 1 : 0,
          transform: transitionPhase >= 1 ? "translateY(-40px)" : "translateY(0)",
          transition: transitionPhase >= 1
            ? "opacity 400ms ease, transform 700ms cubic-bezier(0.4, 0, 1, 1)"
            : bootPhase === "ready"
              ? "opacity 400ms ease"
              : "none",
          pointerEvents: showHeroText ? "auto" : "none",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(4.5rem, 12vw, 10rem)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            fontFamily: "var(--font-display), system-ui, sans-serif",
            textShadow: "0 2px 40px rgba(0,0,0,0.8), 0 0 80px rgba(255,255,255,0.08)",
            minHeight: "1.1em",
          }}
        >
          {titleText}
          <span
            style={{
              opacity: showCursor ? 1 : 0,
              animation: showCursor ? "cursor-blink 1s step-end infinite" : "none",
              color: "#fff",
              fontWeight: 200,
            }}
          >
            |
          </span>
          {!showCursor && displayedChars > 0 && (
            <span
              style={{
                animation: "cursor-blink 1s step-end infinite",
                color: "rgba(255,255,255,0.3)",
                fontWeight: 200,
              }}
            >
              |
            </span>
          )}
        </h1>

        <p
          style={{
            marginTop: "28px",
            fontSize: "clamp(0.9375rem, 1.6vw, 1.125rem)",
            color: "rgba(255,255,255,0.6)",
            fontFamily: "var(--font-space-mono), monospace",
            letterSpacing: "0.15em",
            lineHeight: 1.6,
            textTransform: "lowercase",
            textShadow: "0 2px 20px rgba(0,0,0,0.9)",
            transition: "opacity 800ms ease",
            opacity: sloganVisible ? 1 : 0,
          }}
        >
          {SLOGAN}
        </p>

        <button
          onClick={handleEnter}
          style={{
            marginTop: "64px",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.35)",
            background: "none",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "9999px",
            padding: "12px 36px",
            cursor: "pointer",
            fontFamily: "var(--font-space-mono), monospace",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            transition: "opacity 800ms ease, color 200ms ease, border-color 200ms ease",
            opacity: buttonVisible ? 1 : 0,
            pointerEvents: buttonVisible ? "auto" : "none",
            outline: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.35)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          }}
        >
          click to start
        </button>
      </div>

      {/* ═══ LAYER 4: Globe HUD overlay ═══ */}
      {showHUD && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "32px",
          }}
        >
          {/* Top bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "#33ccaa",
                  fontFamily: "var(--font-space-mono), monospace",
                  fontSize: "12px",
                  letterSpacing: "0.3em",
                  fontWeight: 500,
                }}
              >
                GLOBAL_OVERSEER v2.4
              </span>
              <span
                style={{
                  color: "#555",
                  fontFamily: "var(--font-space-mono), monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  marginTop: "4px",
                }}
              >
                AWAITING TARGET SELECTION...
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 10px rgba(16,185,129,0.8)",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  color: "#666",
                  fontFamily: "var(--font-space-mono), monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                }}
              >
                SAT-LINK ONLINE
              </span>
            </div>
          </motion.div>

          {/* Location panel */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              left: "64px",
              pointerEvents: "auto",
            }}
          >
            <AnimatePresence mode="wait">
              {activeTarget && (
                <motion.div
                  key={activeTarget.id}
                  initial={{ opacity: 0, x: -50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{
                    boxShadow: "0 25px 50px rgba(16,185,129,0.15)",
                    borderRadius: "16px",
                  }}
                >
                  <LocationMap
                    location={activeTarget.name}
                    coordinates={activeTarget.coordinates}
                    onClose={() => {
                      setActiveTarget(null);
                      setGlobePaused(false);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Background glow for globe view */}
      {showGlobe && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, rgba(16,185,129,0.04) 0%, black 70%)",
            pointerEvents: "none",
            zIndex: 0,
            opacity: transitionPhase >= 3 ? 1 : 0,
            transition: "opacity 1000ms ease",
          }}
        />
      )}
    </div>
  );
}
