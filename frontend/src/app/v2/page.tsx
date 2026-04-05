"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const AsciiSphere = dynamic(
  () => import("@/components/ui/ascii-sphere").then((m) => m.AsciiSphere),
  { ssr: false }
);

const TITLE = "Watchman";
const SLOGAN = "See everything. Miss nothing.";
const TYPE_SPEED = 150; // ms per character
const SLOGAN_DELAY = 400; // ms after title finishes
const BUTTON_DELAY = 600; // ms after slogan appears

export default function V2Page() {
  const router = useRouter();
  const [displayedChars, setDisplayedChars] = useState(0);
  const [sloganVisible, setSloganVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Typewriter effect
  useEffect(() => {
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
    }, 800); // initial pause before typing starts

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Show slogan after title finishes
  useEffect(() => {
    if (displayedChars < TITLE.length) return;
    const t = setTimeout(() => setSloganVisible(true), SLOGAN_DELAY);
    return () => clearTimeout(t);
  }, [displayedChars]);

  // Show button after slogan
  useEffect(() => {
    if (!sloganVisible) return;
    const t = setTimeout(() => setButtonVisible(true), BUTTON_DELAY);
    return () => clearTimeout(t);
  }, [sloganVisible]);

  const handleEnter = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => {
      router.push("/v2/globe");
    }, 800);
  }, [exiting, router]);

  const titleText = TITLE.slice(0, displayedChars);
  const showCursor = displayedChars < TITLE.length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 10000,
        overflow: "hidden",
      }}
    >
      {/* ASCII sphere background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transition: "transform 800ms cubic-bezier(0.16, 1, 0.3, 1), opacity 800ms ease",
          transform: exiting ? "scale(3)" : "scale(1)",
          opacity: exiting ? 0 : 0.6,
        }}
      >
        <AsciiSphere />
      </div>

      {/* Dark overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%)",
          zIndex: 1,
          transition: "opacity 800ms ease",
          opacity: exiting ? 1 : 1,
        }}
      />

      {/* Content overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 600ms ease",
          opacity: exiting ? 0 : 1,
        }}
      >
        {/* Title with typewriter */}
        <h1
          style={{
            fontSize: "clamp(3rem, 8vw, 6rem)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            textShadow: "0 0 40px rgba(255,255,255,0.15)",
            minHeight: "1.2em",
          }}
        >
          {titleText}
          <span
            style={{
              opacity: showCursor ? 1 : 0,
              animation: showCursor ? "cursor-blink 1s step-end infinite" : "none",
              color: "#fff",
              fontWeight: 300,
            }}
          >
            |
          </span>
          {/* Cursor after typing is done */}
          {!showCursor && displayedChars > 0 && (
            <span
              style={{
                animation: "cursor-blink 1s step-end infinite",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 300,
              }}
            >
              |
            </span>
          )}
        </h1>

        {/* Slogan */}
        <p
          style={{
            marginTop: "16px",
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            letterSpacing: "0.05em",
            transition: "opacity 800ms ease",
            opacity: sloganVisible ? 1 : 0,
          }}
        >
          {SLOGAN}
        </p>

        {/* Click to start */}
        <button
          onClick={handleEnter}
          style={{
            marginTop: "48px",
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.2)",
            background: "none",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "9999px",
            padding: "10px 28px",
            cursor: "pointer",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            letterSpacing: "0.1em",
            transition: "opacity 800ms ease, color 200ms ease, border-color 200ms ease",
            opacity: buttonVisible ? 1 : 0,
            pointerEvents: buttonVisible ? "auto" : "none",
            outline: "none",
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget;
            btn.style.color = "rgba(255,255,255,0.5)";
            btn.style.borderColor = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget;
            btn.style.color = "rgba(255,255,255,0.2)";
            btn.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        >
          click here to start
        </button>
      </div>
    </div>
  );
}
