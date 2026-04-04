"use client";

import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/session";

export default function BuildingPage() {
  const [sessionId, setSession] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSessionId());
  }, []);

  return (
    <main
      className="relative flex flex-1 flex-col items-center justify-center min-h-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Corner brackets */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-6 left-6 h-8 w-8 border-t-2 border-l-2"
        style={{ borderColor: "var(--color-accent-cyan)", opacity: 0.5 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-6 right-6 h-8 w-8 border-t-2 border-r-2"
        style={{ borderColor: "var(--color-accent-cyan)", opacity: 0.5 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-6 left-6 h-8 w-8 border-b-2 border-l-2"
        style={{ borderColor: "var(--color-accent-cyan)", opacity: 0.5 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-6 right-6 h-8 w-8 border-b-2 border-r-2"
        style={{ borderColor: "var(--color-accent-cyan)", opacity: 0.5 }}
      />

      {/* Top banner */}
      <div
        className="absolute top-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-[0.3em] hud-pulse"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-accent-green)",
        }}
      >
        BUILDING VIEW
      </div>

      {/* Main content */}
      <section className="flex flex-col items-center gap-4 text-center px-8">
        <h1
          className="glow-cyan font-mono font-bold tracking-[0.15em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-accent-cyan)",
            fontSize: "clamp(1.5rem, 4vw, 3rem)",
          }}
        >
          BUILDING VIEW
        </h1>

        <p
          className="glow-green font-mono text-sm tracking-[0.4em] uppercase cursor-blink"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-accent-green)",
          }}
        >
          LOADING 3D ENVIRONMENT
        </p>

        {sessionId && (
          <p
            className="font-mono text-xs mt-4"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-dim)",
              letterSpacing: "0.1em",
            }}
          >
            SESSION: {sessionId.slice(0, 8).toUpperCase()}
          </p>
        )}
      </section>

      {/* Bottom status */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-dim)",
        }}
      >
        PHASE 3 IMPLEMENTATION PENDING
      </div>
    </main>
  );
}
