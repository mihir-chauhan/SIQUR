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

const CAMERA_LABELS = ["CAM_H1 // NORTH ENTRY", "CAM_H2 // EAST CORRIDOR", "CAM_H3 // SERVER ROOM", "CAM_H4 // MAIN LOBBY"];

export default function TrainingPage() {
  const router = useRouter();
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"training" | "feed">("training");
  const [feedReady, setFeedReady] = useState([false, false, false, false]);
  const startTime = useRef(Date.now());
  const redirected = useRef(false);

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
      const elapsed = Date.now() - startTime.current;
      setProgress(Math.min(elapsed / 10000, 1));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Stagger feed panels coming online
  useEffect(() => {
    if (phase !== "feed") return;
    const timers = [0, 1, 2, 3].map((i) =>
      setTimeout(() => setFeedReady((prev) => { const n = [...prev]; n[i] = true; return n; }), 400 + i * 350)
    );
    // Redirect after 10s total from page load
    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, 10000 - elapsed);
    const redirect = setTimeout(() => {
      if (!redirected.current) {
        redirected.current = true;
        router.push("/v2/evaluate");
      }
    }, remaining);
    return () => { timers.forEach(clearTimeout); clearTimeout(redirect); };
  }, [phase, router]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#0a0e14",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-space-mono, monospace)",
      overflow: "hidden",
    }}>
      {/* Scan lines overlay */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
      }} />

      {phase === "training" && (
        <div style={{ zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 640 }}>
          {/* Spinning ring */}
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            border: "2px solid rgba(0, 229, 255, 0.12)", borderTopColor: "#00e5ff",
            animation: "spin 1.2s linear infinite",
            marginBottom: 28,
            boxShadow: "0 0 20px rgba(0, 229, 255, 0.1)",
          }} />

          <div style={{ color: "#00e5ff", fontSize: 13, fontWeight: 700, letterSpacing: "0.35em", marginBottom: 6 }}>
            TRAINING CAMERA MODELS
          </div>
          <div style={{ color: "rgba(0, 229, 255, 0.3)", fontSize: 9, letterSpacing: "0.25em", marginBottom: 36 }}>
            GENERATING BESPOKE SURVEILLANCE AI
          </div>

          {/* Terminal */}
          <div style={{ width: "100%", padding: "0 24px" }}>
            {visibleLines.map((line, i) => (
              <div key={i} style={{
                color: i === visibleLines.length - 1 ? "rgba(0, 229, 255, 0.9)" : `rgba(0, 229, 255, ${Math.max(0.2, (i + 1) / visibleLines.length * 0.5)})`,
                fontSize: 10, lineHeight: "20px", whiteSpace: "nowrap",
                animation: "fadeSlideIn 0.3s ease-out",
              }}>
                <span style={{ color: "rgba(0, 229, 255, 0.25)", marginRight: 8 }}>
                  [{String(i + 1).padStart(2, "0")}]
                </span>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "feed" && (
        <div style={{ zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{
            padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <span style={{ color: "#00e5ff", fontSize: 12, fontWeight: 700, letterSpacing: "0.3em" }}>
                CAMERA FEEDS
              </span>
              <span style={{ color: "rgba(0, 229, 255, 0.3)", fontSize: 9, letterSpacing: "0.15em", marginLeft: 16 }}>
                MODELS DEPLOYED — INITIALIZING LIVE PREVIEW
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse-dot 2s infinite" }} />
              <span style={{ color: "rgba(0, 229, 255, 0.4)", fontSize: 9, letterSpacing: "0.1em" }}>LIVE</span>
            </div>
          </div>

          {/* 2x2 Camera grid */}
          <div style={{
            flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
            gap: 2, padding: "0 2px 2px 2px",
          }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                position: "relative", background: "#060a10",
                border: feedReady[i] ? "1px solid rgba(0, 229, 255, 0.15)" : "1px solid rgba(255,255,255,0.03)",
                overflow: "hidden",
                opacity: feedReady[i] ? 1 : 0.3,
                transition: "opacity 0.6s ease, border-color 0.6s ease",
              }}>
                {/* Static noise pattern */}
                <div style={{
                  position: "absolute", inset: 0,
                  backgroundImage: feedReady[i]
                    ? `url("/camera-screenshots/cam_h${i + 1}.png")`
                    : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "brightness(0.6) contrast(1.2)",
                }} />

                {/* Scan line */}
                {feedReady[i] && (
                  <div style={{
                    position: "absolute", left: 0, right: 0, height: 1,
                    background: "rgba(0, 229, 255, 0.3)",
                    animation: `scanFeed 3s linear infinite`,
                    animationDelay: `${i * 0.7}s`,
                  }} />
                )}

                {/* HUD overlay */}
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 12 }}>
                  {/* Top: camera label */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ color: "rgba(0, 229, 255, 0.7)", fontSize: 9, letterSpacing: "0.15em", fontWeight: 600 }}>
                      {CAMERA_LABELS[i]}
                    </span>
                    {feedReady[i] && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />
                        <span style={{ color: "#10b981", fontSize: 9, letterSpacing: "0.1em" }}>ONLINE</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom: status */}
                  <div>
                    {!feedReady[i] && (
                      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: "0.1em" }}>
                        CONNECTING...
                      </span>
                    )}
                    {feedReady[i] && (
                      <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ color: "rgba(0, 229, 255, 0.4)", fontSize: 9, letterSpacing: "0.1em" }}>
                          AI: ACTIVE
                        </span>
                        <span style={{ color: "rgba(0, 229, 255, 0.4)", fontSize: 9, letterSpacing: "0.1em" }}>
                          FPS: 24
                        </span>
                        <span style={{ color: "rgba(0, 229, 255, 0.4)", fontSize: 9, letterSpacing: "0.1em" }}>
                          RES: 2K
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Corner brackets */}
                {feedReady[i] && <>
                  <div style={{ position: "absolute", top: 4, left: 4, width: 12, height: 12, borderTop: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" }} />
                  <div style={{ position: "absolute", top: 4, right: 4, width: 12, height: 12, borderTop: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" }} />
                  <div style={{ position: "absolute", bottom: 4, left: 4, width: 12, height: 12, borderBottom: "1px solid rgba(0,229,255,0.3)", borderLeft: "1px solid rgba(0,229,255,0.3)" }} />
                  <div style={{ position: "absolute", bottom: 4, right: 4, width: 12, height: 12, borderBottom: "1px solid rgba(0,229,255,0.3)", borderRight: "1px solid rgba(0,229,255,0.3)" }} />
                </>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(0, 229, 255, 0.08)", zIndex: 10, display: "flex", alignItems: "center" }}>
        <div style={{
          height: "100%", width: `${progress * 100}%`,
          background: "#00e5ff", transition: "width 0.05s linear",
          boxShadow: "0 0 8px rgba(0, 229, 255, 0.5)",
          flex: "none",
        }} />
        <span style={{
          color: "rgba(0, 229, 255, 0.5)", fontSize: 9, fontFamily: "var(--font-space-mono, monospace)",
          letterSpacing: "0.1em", marginLeft: 8, whiteSpace: "nowrap",
        }}>
          {Math.round(progress * 100)}%
        </span>
      </div>

      {/* Skip button */}
      <button
        onClick={() => router.push("/v2/evaluate")}
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 20,
          background: "none", border: "none",
          color: "#00e5ff", fontSize: 10,
          fontFamily: "var(--font-space-mono, monospace)",
          letterSpacing: "0.15em", cursor: "pointer",
          opacity: 0.4, transition: "opacity 0.2s ease",
          padding: 0,
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
        @keyframes scanFeed { 0% { top: 0%; } 100% { top: 100%; } }
      `}</style>
    </div>
  );
}
