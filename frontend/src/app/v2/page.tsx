"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const AsciiSphere = dynamic(
  () => import("@/components/ui/ascii-sphere").then((m) => m.AsciiSphere),
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

type ViewState = "hero" | "transitioning";

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

  const router = useRouter();

  // View state
  const [view, setView] = useState<ViewState>("hero");
  const [transitionPhase, setTransitionPhase] = useState(0);

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

    // Phase 2: ASCII zooms forward
    setTimeout(() => setTransitionPhase(2), 400);

    // Phase 3: Route to globe explicitly
    setTimeout(() => {
      setTransitionPhase(3);
      router.push("/v2/globe");
    }, 1400);
  }, [view, router]);

  const titleText = TITLE.slice(0, displayedChars);
  const showCursor = displayedChars < TITLE.length && bootPhase === "ready";
  const isBooted = bootPhase === "ready" || bootPhase === "flickering";

  const showAscii = view === "hero" || (view === "transitioning" && transitionPhase < 3);
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



    </div>
  );
}
