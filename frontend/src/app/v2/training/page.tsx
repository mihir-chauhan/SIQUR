"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const TRAINING_LINES = [
  "LOADING CAMERA POSITION DATA — 4 ENDPOINTS...",
  "GENERATING SYNTHETIC TRAINING DATASET...",
  "INITIALIZING NEURAL NETWORK — CONV2D × 6 LAYERS...",
  "TRAINING EPOCH 1/50 — LOSS: 0.8432",
  "TRAINING EPOCH 25/50 — LOSS: 0.0891",
  "TRAINING EPOCH 50/50 — LOSS: 0.0124",
  "MODEL CONVERGED — ACCURACY: 97.8%",
  "DEPLOYING TO EDGE INFERENCE ENGINE...",
];

const VIDEOS = [
  "cam1__daylight_disturbance.mp4","cam1__daylight_loitering.mp4","cam1__daylight_normal_traffic.mp4",
  "cam1__daylight_theft.mp4","cam1__dusk_disturbance.mp4","cam1__dusk_loitering.mp4",
  "cam1__dusk_normal_traffic.mp4","cam1__dusk_theft.mp4","cam1__night_disturbance.mp4",
  "cam1__night_loitering.mp4","cam1__night_normal_traffic.mp4","cam1__night_theft.mp4",
  "cam1__overcast_disturbance.mp4","cam1__overcast_loitering.mp4","cam1__overcast_normal_traffic.mp4",
  "cam1__overcast_theft.mp4","cam2-2__daylight_disturbance.mp4","cam2-2__daylight_loitering.mp4",
  "cam2-2__daylight_normal_traffic.mp4","cam2-2__daylight_theft.mp4","cam2-2__dusk_disturbance.mp4",
  "cam2-2__dusk_loitering.mp4","cam2-2__dusk_normal_traffic.mp4","cam2-2__dusk_theft.mp4",
  "cam2-2__night_disturbance.mp4","cam2-2__night_loitering.mp4","cam2-2__night_normal_traffic.mp4",
  "cam2-2__night_theft.mp4","cam2-2__overcast_disturbance.mp4","cam2-2__overcast_loitering.mp4",
  "cam2-2__overcast_normal_traffic.mp4","cam2-2__overcast_theft.mp4","cam3-2__daylight_disturbance.mp4",
  "cam3-2__daylight_loitering.mp4","cam3-2__daylight_normal_traffic.mp4","cam3-2__daylight_theft.mp4",
  "cam3-2__dusk_disturbance.mp4","cam3-2__dusk_loitering.mp4","cam3-2__dusk_normal_traffic.mp4",
  "cam3-2__dusk_theft.mp4","cam3-2__night_disturbance.mp4","cam3-2__night_loitering.mp4",
  "cam3-2__night_normal_traffic.mp4","cam3-2__night_theft.mp4","cam3-2__overcast_disturbance.mp4",
  "cam3-2__overcast_loitering.mp4","cam3-2__overcast_normal_traffic.mp4","cam3-2__overcast_theft.mp4",
  "cam4__daylight_disturbance.mp4","cam4__daylight_loitering.mp4","cam4__daylight_normal_traffic.mp4",
  "cam4__daylight_theft.mp4","cam4__dusk_disturbance.mp4","cam4__dusk_loitering.mp4",
  "cam4__dusk_normal_traffic.mp4","cam4__dusk_theft.mp4","cam4__night_disturbance.mp4",
  "cam4__night_loitering.mp4","cam4__night_normal_traffic.mp4","cam4__night_theft.mp4",
  "cam4__overcast_disturbance.mp4","cam4__overcast_loitering.mp4","cam4__overcast_normal_traffic.mp4",
  "cam4__overcast_theft.mp4","sus1.mp4",
];

const GRID = 36; // 6×6

function randomVideo() {
  return "/training-videos/" + VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
}

function initGrid(): string[] {
  return Array.from({ length: GRID }, () => randomVideo());
}

export default function TrainingPage() {
  const router = useRouter();
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"training" | "feed">("training");
  const [cellVideos, setCellVideos] = useState<string[]>(() => initGrid());
  const startTime = useRef(Date.now());
  const redirected = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Terminal lines
  useEffect(() => {
    let idx = 0;
    let phaseTimeout: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      if (idx < TRAINING_LINES.length) {
        setVisibleLines((prev) => [...prev, TRAINING_LINES[idx]]);
        idx++;
      } else {
        clearInterval(timer);
        phaseTimeout = setTimeout(() => setPhase("feed"), 600);
      }
    }, 450);
    return () => { clearInterval(timer); clearTimeout(phaseTimeout); };
  }, []);

  // Progress bar
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(Math.min((Date.now() - startTime.current) / 15000, 1));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Random video replacement — fires every 300–600ms, replaces 3–7 cells
  // Each replaced cell gets a video different from what it currently shows
  useEffect(() => {
    if (phase !== "feed") return;

    const schedule = () => {
      const delay = 300 + Math.random() * 300;
      return setTimeout(() => {
        const count = 3 + Math.floor(Math.random() * 5);
        const indices = new Set<number>();
        while (indices.size < count) {
          indices.add(Math.floor(Math.random() * GRID));
        }
        setCellVideos((prev) => {
          const next = [...prev];
          for (const i of indices) {
            let next_vid = randomVideo();
            // Keep picking until we get something different from what's there
            let tries = 0;
            while (next_vid === prev[i] && tries < 10) {
              next_vid = randomVideo();
              tries++;
            }
            next[i] = next_vid;
          }
          return next;
        });
        timerRef.current = schedule();
      }, delay);
    };

    timerRef.current = schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  // Redirect after 10s total
  useEffect(() => {
    if (phase !== "feed") return;
    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, 15000 - elapsed);
    const t = setTimeout(() => {
      if (!redirected.current) {
        redirected.current = true;
        router.push("/v2/evaluate");
      }
    }, remaining);
    return () => clearTimeout(t);
  }, [phase, router]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#0a0e14",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-space-mono, monospace)",
      overflow: "hidden",
    }}>
      {/* Scan lines */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
      }} />

      {phase === "training" && (
        <div style={{ zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 640 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            border: "2px solid rgba(0,229,255,0.12)", borderTopColor: "#00e5ff",
            animation: "spin 1.2s linear infinite",
            marginBottom: 28,
            boxShadow: "0 0 20px rgba(0,229,255,0.1)",
          }} />
          <div style={{ color: "#00e5ff", fontSize: 13, fontWeight: 700, letterSpacing: "0.35em", marginBottom: 6 }}>
            TRAINING CAMERA MODELS
          </div>
          <div style={{ color: "rgba(0,229,255,0.3)", fontSize: 9, letterSpacing: "0.25em", marginBottom: 36 }}>
            GENERATING BESPOKE SURVEILLANCE AI
          </div>
          <div style={{ width: "100%", padding: "0 24px" }}>
            {visibleLines.map((line, i) => (
              <div key={i} style={{
                color: i === visibleLines.length - 1 ? "rgba(0,229,255,0.9)" : `rgba(0,229,255,${Math.max(0.2, (i + 1) / visibleLines.length * 0.5)})`,
                fontSize: 10, lineHeight: "20px", whiteSpace: "nowrap",
                animation: "fadeSlideIn 0.3s ease-out",
              }}>
                <span style={{ color: "rgba(0,229,255,0.25)", marginRight: 8 }}>[{String(i + 1).padStart(2, "0")}]</span>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "feed" && (
        <div style={{ zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div>
              <span style={{ color: "#00e5ff", fontSize: 12, fontWeight: 700, letterSpacing: "0.3em" }}>
                SYNTHETIC TRAINING FEEDS
              </span>
              <span style={{ color: "rgba(0,229,255,0.3)", fontSize: 9, letterSpacing: "0.15em", marginLeft: 16 }}>
                MODELS DEPLOYED — LIVE PREVIEW
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse-dot 2s infinite" }} />
              <span style={{ color: "rgba(0,229,255,0.4)", fontSize: 9, letterSpacing: "0.1em" }}>LIVE</span>
            </div>
          </div>

          {/* 6×6 grid */}
          <div style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gridTemplateRows: "repeat(6, 1fr)",
            gap: 2,
            padding: "0 2px 2px 2px",
            overflow: "hidden",
          }}>
            {cellVideos.map((src, i) => (
              <div key={i} style={{ position: "relative", overflow: "hidden", background: "#000", border: "1px solid rgba(0,229,255,0.08)" }}>
                <video
                  key={src}
                  src={src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.75) contrast(1.1)" }}
                />
                {/* HUD overlay */}
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  padding: "3px 4px",
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(0,229,255,0.5)", letterSpacing: "0.05em" }}>
                    F{String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                    <span style={{ fontFamily: "monospace", fontSize: 6, color: "rgba(16,185,129,0.7)", letterSpacing: "0.04em" }}>AI</span>
                  </div>
                </div>
                {/* Corner brackets */}
                <div style={{ position: "absolute", top: 2, left: 2, width: 6, height: 6, borderTop: "1px solid rgba(0,229,255,0.25)", borderLeft: "1px solid rgba(0,229,255,0.25)" }} />
                <div style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderTop: "1px solid rgba(0,229,255,0.25)", borderRight: "1px solid rgba(0,229,255,0.25)" }} />
                <div style={{ position: "absolute", bottom: 2, left: 2, width: 6, height: 6, borderBottom: "1px solid rgba(0,229,255,0.25)", borderLeft: "1px solid rgba(0,229,255,0.25)" }} />
                <div style={{ position: "absolute", bottom: 2, right: 2, width: 6, height: 6, borderBottom: "1px solid rgba(0,229,255,0.25)", borderRight: "1px solid rgba(0,229,255,0.25)" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(0,229,255,0.08)", zIndex: 10, display: "flex", alignItems: "center" }}>
        <div style={{
          height: "100%", width: `${progress * 100}%`,
          background: "#00e5ff", transition: "width 0.05s linear",
          boxShadow: "0 0 8px rgba(0,229,255,0.5)", flex: "none",
        }} />
        <span style={{
          color: "rgba(0,229,255,0.5)", fontSize: 9, fontFamily: "var(--font-space-mono, monospace)",
          letterSpacing: "0.1em", marginLeft: 8, whiteSpace: "nowrap",
        }}>
          {Math.round(progress * 100)}%
        </span>
      </div>

      {/* Skip */}
      <button
        onClick={() => router.push("/v2/evaluate")}
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 20,
          background: "none", border: "none",
          color: "#00e5ff", fontSize: 10,
          fontFamily: "var(--font-space-mono, monospace)",
          letterSpacing: "0.15em", cursor: "pointer",
          opacity: 0.4, transition: "opacity 0.2s ease", padding: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
      >
        SKIP →
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
