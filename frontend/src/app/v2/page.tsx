"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const AsciiSphere = dynamic(
  () => import("@/components/ui/ascii-sphere").then((m) => m.AsciiSphere),
  { ssr: false }
);

const TITLE = "Siqor";
const SLOGAN = "See everything. Miss nothing.";
const TYPE_SPEED = 150;
const SLOGAN_DELAY = 400;
const BUTTON_DELAY = 600;

// Boot timing (ms)
const SCAN_START   = 300;
const SCAN_DURATION = 2000;
const FLICKER_START = SCAN_START + SCAN_DURATION;       // 2300
const READY_AT      = FLICKER_START + 200;              // 2500
const TYPE_START    = READY_AT + 200;                   // 2700

type BootPhase = "black" | "scanning" | "flickering" | "ready";
type ViewState  = "hero" | "transitioning";

export default function V2Page() {
  const [bootPhase, setBootPhase]         = useState<BootPhase>("black");
  const [displayedChars, setDisplayedChars] = useState(0);
  const [sloganVisible, setSloganVisible]  = useState(false);
  const [buttonVisible, setButtonVisible]  = useState(false);
  const [view, setView]                    = useState<ViewState>("hero");
  const [transitionPhase, setTransitionPhase] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // ─── Boot sequence (pure timeouts — no 60fps interval) ────────────
  useEffect(() => {
    const t1 = setTimeout(() => setBootPhase("scanning"),   SCAN_START);
    const t2 = setTimeout(() => setBootPhase("flickering"), FLICKER_START);
    const t3 = setTimeout(() => setBootPhase("ready"),      READY_AT);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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
    }, TYPE_START - READY_AT);

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
    setTransitionPhase(1);
    setTimeout(() => setTransitionPhase(2), 400);
    setTimeout(() => { setTransitionPhase(3); router.push("/v2/globe"); }, 1400);
  }, [view, router]);

  const titleText  = TITLE.slice(0, displayedChars);
  const showCursor = displayedChars < TITLE.length && bootPhase === "ready";
  const isBooted   = bootPhase === "ready" || bootPhase === "flickering";
  const showAscii  = view === "hero" || (view === "transitioning" && transitionPhase < 3);
  const showHeroText = view === "hero";

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "#000",
        zIndex: 10000,
        overflow: "hidden",
      }}
    >
      <style>{`
        html, body, .scanlines, .app-shell { background: #000 !important; }

        @keyframes crt-flicker {
          0%, 100% { opacity: 0.7; }
          10%  { opacity: 0.5; }
          20%  { opacity: 0.8; }
          30%  { opacity: 0.6; }
          50%  { opacity: 0.75; }
          70%  { opacity: 0.65; }
          90%  { opacity: 0.7; }
        }

        /* CSS-driven scan reveal — zero JS per-frame */
        @keyframes scan-reveal {
          from { clip-path: inset(0 0 100% 0); }
          to   { clip-path: inset(0 0 0% 0); }
        }

        /* CSS-driven beam sweep */
        @keyframes beam-sweep {
          from { top: 0%; }
          to   { top: 100%; }
        }

        .ascii-scanning {
          animation: scan-reveal ${SCAN_DURATION}ms linear forwards;
        }
        .ascii-ready {
          clip-path: inset(0 0 0% 0);
        }

        .scan-beam {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: rgba(0, 229, 255, 0.7);
          box-shadow: 0 0 12px 3px rgba(0, 229, 255, 0.4),
                      0 0 40px 8px rgba(0, 229, 255, 0.15);
          animation: beam-sweep ${SCAN_DURATION}ms linear forwards;
          z-index: 5;
          pointer-events: none;
        }

        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }

        @keyframes btn-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,229,255,0.12), inset 0 0 20px rgba(0,229,255,0.05); }
          50%      { box-shadow: 0 0 30px rgba(0,229,255,0.22), inset 0 0 25px rgba(0,229,255,0.08); }
        }
      `}</style>

      {/* ═══ LAYER 0: ASCII sphere ═══ */}
      {showAscii && (
        <div
          className={
            bootPhase === "scanning" ? "ascii-scanning" :
            bootPhase === "flickering" || bootPhase === "ready" ? "ascii-ready" : ""
          }
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "center center",
            opacity: transitionPhase >= 2 ? 0 : 0.7,
            transform: transitionPhase >= 2 ? "scale(6)" : "scale(1)",
            willChange: transitionPhase >= 1 ? "transform, opacity" : "auto",
            transition: transitionPhase >= 2
              ? "transform 1200ms cubic-bezier(0.25, 0, 0, 1), opacity 1000ms ease"
              : "none",
            animation: bootPhase === "flickering"
              ? "crt-flicker 0.3s ease 3"
              : undefined,
            zIndex: 0,
          }}
        >
          <AsciiSphere />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, rgba(0, 229, 255, 0.04) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
        </div>
      )}

      {/* Scanning beam — CSS animated, no React state */}
      {bootPhase === "scanning" && <div className="scan-beam" />}

      {/* ═══ LAYER 2: Dark vignette ═══ */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.85) 100%)",
          opacity: transitionPhase >= 2 ? 0 : 1,
          transition: "opacity 600ms ease",
          pointerEvents: "none",
        }}
      />

      {/* ═══ LAYER 3: Hero text ═══ */}
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
            textShadow: "0 2px 40px rgba(0,0,0,0.8), 0 0 80px rgba(0,229,255,0.07), 0 0 160px rgba(0,229,255,0.04)",
            minHeight: "1.1em",
          }}
        >
          {titleText}
          <span
            style={{
              opacity: showCursor ? 1 : 0,
              animation: showCursor ? "cursor-blink 1s step-end infinite" : "none",
              color: "#00e5ff",
              fontWeight: 200,
            }}
          >
            |
          </span>
          {!showCursor && displayedChars > 0 && (
            <span
              style={{
                animation: "cursor-blink 1s step-end infinite",
                color: "rgba(0, 229, 255, 0.25)",
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
            color: "rgba(0, 229, 255, 0.55)",
            fontFamily: "var(--font-space-mono), monospace",
            letterSpacing: "0.15em",
            lineHeight: 1.6,
            textTransform: "lowercase",
            textShadow: "0 2px 20px rgba(0,0,0,0.9), 0 0 40px rgba(0,229,255,0.1)",
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
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#00e5ff",
            background: "rgba(0, 10, 15, 0.9)",
            border: "1px solid rgba(0, 229, 255, 0.5)",
            backdropFilter: "blur(16px)",
            borderRadius: "9999px",
            padding: "14px 44px",
            cursor: "pointer",
            fontFamily: "var(--font-space-mono), monospace",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            animation: buttonVisible ? "btn-glow-pulse 3s ease-in-out infinite" : "none",
            transition: "opacity 800ms ease, color 200ms ease, border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease",
            opacity: buttonVisible ? 1 : 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.8)";
            e.currentTarget.style.animation = "none";
            e.currentTarget.style.boxShadow = "0 0 40px rgba(0, 229, 255, 0.3), 0 0 80px rgba(0, 229, 255, 0.12), inset 0 0 30px rgba(0, 229, 255, 0.08)";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.5)";
            e.currentTarget.style.animation = "btn-glow-pulse 3s ease-in-out infinite";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          click to start
        </button>
      </div>
    </div>
  );
}
