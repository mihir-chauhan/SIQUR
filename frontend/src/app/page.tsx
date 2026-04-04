"use client";

import dynamic from "next/dynamic";

const GlobeView = dynamic(() => import("@/components/GlobeView"), {
  ssr: false,
  loading: () => <GlobeLoadingState />,
});

export default function Home() {
  return (
    <main
      className="relative flex-1 w-full h-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <GlobeView />
    </main>
  );
}

function GlobeLoadingState() {
  return (
    <div
      className="relative flex flex-col items-center justify-center w-full h-screen"
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
        SYSTEM ONLINE
      </div>

      {/* Main loading content */}
      <section className="flex flex-col items-center gap-6 text-center px-8">
        <p
          className="font-mono text-xs tracking-[0.5em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-accent-cyan)",
            opacity: 0.6,
          }}
        >
          CLASSIFICATION: EYES ONLY
        </p>

        <h1
          className="glow-cyan font-mono font-bold tracking-[0.15em] uppercase select-none flicker"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-accent-cyan)",
            fontSize: "clamp(2.5rem, 7vw, 6rem)",
            lineHeight: 1.05,
          }}
        >
          MINORITY
          <br />
          REPORT
        </h1>

        <div
          className="h-px w-48 mx-auto"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--color-accent-cyan), transparent)",
            opacity: 0.4,
          }}
        />

        <p
          className="glow-green font-mono text-sm tracking-[0.4em] uppercase cursor-blink"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-accent-green)",
          }}
        >
          ESTABLISHING SATELLITE LINK
        </p>

        <p
          className="font-mono text-xs mt-2"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-dim)",
            letterSpacing: "0.1em",
          }}
        >
          LOADING CESIUM GLOBE ENGINE...
        </p>
      </section>

      {/* Coordinates (bottom) */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 font-mono text-xs tracking-widest"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-dim)",
        }}
      >
        <span>LAT 40.4274&#176; N</span>
        <span style={{ color: "var(--color-accent-cyan)", opacity: 0.3 }}>
          |
        </span>
        <span>LON 86.9167&#176; W</span>
        <span style={{ color: "var(--color-accent-cyan)", opacity: 0.3 }}>
          |
        </span>
        <span>ALT 0.8 KM</span>
      </div>
    </div>
  );
}
