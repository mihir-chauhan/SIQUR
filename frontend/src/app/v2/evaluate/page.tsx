"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModeSidebar from "@/components/ModeSidebar";
import { getPlacedCameras } from "@/lib/session";
import type { Camera } from "@/lib/types";

// Fixed video pools — indexed by camera slot mod pool size
const FIGHT_VIDEOS = [
  "/videos/fight_0.mp4",
  "/videos/fight_1.mp4",
  "/videos/fight_2.mp4",
  "/videos/fight_3.mp4",
];
const NORMAL_VIDEOS = [
  "/videos/normal_0.mp4",
  "/videos/normal_1.mp4",
  "/videos/normal_2.mp4",
  "/videos/normal_3.mp4",
];

type SimState = "idle" | "generating" | "done";

function classifyPrompt(prompt: string): "fight" | "normal" | null {
  const lower = prompt.toLowerCase();
  if (lower.includes("fight")) return "fight";
  if (lower.includes("normal")) return "normal";
  return null;
}

function CameraPovPlaceholder({ camera, index }: { camera: Camera; index: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#050505", overflow: "hidden" }}>
      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)",
      }} />
      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: "linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      {/* Faux room geometry */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }} viewBox="0 0 640 360" preserveAspectRatio="xMidYMid meet">
        {/* Floor perspective lines */}
        <line x1="320" y1="180" x2="0" y2="360" stroke="rgba(0,229,255,0.06)" strokeWidth="1" />
        <line x1="320" y1="180" x2="640" y2="360" stroke="rgba(0,229,255,0.06)" strokeWidth="1" />
        <line x1="320" y1="180" x2="0" y2="0" stroke="rgba(0,229,255,0.04)" strokeWidth="1" />
        <line x1="320" y1="180" x2="640" y2="0" stroke="rgba(0,229,255,0.04)" strokeWidth="1" />
        {/* Horizon */}
        <line x1="0" y1="180" x2="640" y2="180" stroke="rgba(0,229,255,0.05)" strokeWidth="1" />
        {/* FOV cone */}
        <polygon
          points={`320,10 ${320 - camera.fov * 1.8},350 ${320 + camera.fov * 1.8},350`}
          fill="rgba(0,229,255,0.03)"
          stroke="rgba(0,229,255,0.08)"
          strokeWidth="1"
        />
        {/* Center crosshair */}
        <line x1="310" y1="180" x2="330" y2="180" stroke="rgba(0,229,255,0.3)" strokeWidth="1" />
        <line x1="320" y1="170" x2="320" y2="190" stroke="rgba(0,229,255,0.3)" strokeWidth="1" />
        <circle cx="320" cy="180" r="18" fill="none" stroke="rgba(0,229,255,0.12)" strokeWidth="1" />
      </svg>

      {/* HUD overlays */}
      <div style={{ position: "absolute", top: 10, left: 12, zIndex: 5, fontFamily: "monospace", fontSize: 10, color: "rgba(0,229,255,0.6)", letterSpacing: "0.1em" }}>
        CAM {String(index + 1).padStart(2, "0")} // FOV {camera.fov.toFixed(0)}°
      </div>
      <div style={{ position: "absolute", top: 10, right: 12, zIndex: 5, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: tick % 2 === 0 ? "#ef4444" : "transparent",
          border: "1px solid #ef4444",
          display: "inline-block",
          transition: "background 0.1s",
        }} />
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#ef4444", letterSpacing: "0.1em" }}>REC</span>
      </div>
      <div style={{ position: "absolute", bottom: 10, left: 12, zIndex: 5, fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>
        YAW {camera.rotation.yaw.toFixed(1)}° · PITCH {camera.rotation.pitch.toFixed(1)}°
      </div>
      <div style={{ position: "absolute", bottom: 10, right: 12, zIndex: 5, fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>
        {ts}
      </div>
    </div>
  );
}

function GeneratingOverlay() {
  const steps = [
    "Initializing render pipeline...",
    "Sampling camera frustum...",
    "Applying weather & lighting conditions...",
    "Generating synthetic actors...",
    "Running behavior simulation...",
    "Encoding output frames...",
  ];
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(2px)",
    }}>
      {/* Spinner */}
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: "2px solid rgba(251,191,36,0.12)",
        borderTopColor: "#fbbf24",
        animation: "ev-spin 0.9s linear infinite",
        marginBottom: 24,
      }} />
      <div style={{
        fontFamily: "monospace", fontSize: 11, letterSpacing: "0.3em",
        color: "#fbbf24", marginBottom: 20, fontWeight: 700,
      }}>
        GENERATING SYNTHETIC SCENARIO{dots}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start", minWidth: 280 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            fontFamily: "monospace", fontSize: 9, letterSpacing: "0.08em",
            color: i < step ? "rgba(251,191,36,0.5)" : i === step ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", gap: 8,
            transition: "color 0.3s",
          }}>
            <span style={{ color: i < step ? "#fbbf24" : i === step ? "#fbbf24" : "rgba(255,255,255,0.1)" }}>
              {i < step ? "✓" : i === step ? "›" : "·"}
            </span>
            {s}
          </div>
        ))}
      </div>
      <style>{`@keyframes ev-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function EvaluatePage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [simState, setSimState] = useState<SimState>("idle");
  const [classification, setClassification] = useState<"fight" | "normal" | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const cams = getPlacedCameras();
    setCameras(cams);
  }, []);

  const selectedCamera = cameras[selectedIdx] ?? null;

  const handleSelectCamera = (idx: number) => {
    setSelectedIdx(idx);
    setSimState("idle");
    setVideoSrc(null);
    setClassification(null);
  };

  const handleSubmit = () => {
    const cls = classifyPrompt(prompt);
    if (!cls || !selectedCamera) return;

    setSimState("generating");
    setVideoSrc(null);
    setClassification(null);

    const pool = cls === "fight" ? FIGHT_VIDEOS : NORMAL_VIDEOS;
    const src = pool[selectedIdx % pool.length];
    const delay = 5000 + Math.random() * 5000; // 5–10 s

    setTimeout(() => {
      setVideoSrc(src);
      setClassification(cls);
      setSimState("done");
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const borderColor = classification === "fight" ? "#ef4444" : classification === "normal" ? "#22c55e" : "rgba(0,229,255,0.15)";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0a0a", display: "flex" }}
    >
      <ModeSidebar />

      {/* Camera list panel */}
      <div style={{
        position: "absolute", top: 0, left: 48, bottom: 0, width: 200,
        borderRight: "1px solid rgba(251,191,36,0.08)",
        background: "rgba(6,6,6,0.95)",
        display: "flex", flexDirection: "column",
        zIndex: 10,
      }}>
        <div style={{
          height: 40, display: "flex", alignItems: "center", paddingLeft: 14,
          borderBottom: "1px solid rgba(251,191,36,0.08)",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.25em", color: "#fbbf24" }}>
            CAMERAS ({cameras.length})
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cameras.length === 0 ? (
            <div style={{ padding: "24px 14px", fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
              NO CAMERAS PLACED
            </div>
          ) : (
            cameras.map((cam, i) => {
              const active = i === selectedIdx;
              return (
                <button
                  key={cam.id}
                  onClick={() => handleSelectCamera(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "10px 14px",
                    background: active ? "rgba(251,191,36,0.08)" : "transparent",
                    border: "none",
                    borderLeft: active ? "2px solid #fbbf24" : "2px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Camera icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: active ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#fbbf24" : "rgba(255,255,255,0.3)"} strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="18" rx="2" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M2 8h20" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: active ? "#fbbf24" : "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>
                      CAM {String(i + 1).padStart(2, "0")}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em", marginTop: 2 }}>
                      {(cam.placement_score * 100).toFixed(0)}% CVG
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{
        position: "absolute", top: 0, left: 248, right: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* Top bar */}
        <div style={{
          height: 40, display: "flex", alignItems: "center", justifyContent: "center",
          borderBottom: "1px solid rgba(251,191,36,0.08)",
          background: "rgba(6,6,6,0.9)",
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.3em", color: "#fbbf24" }}>
            EVALUATE // SCENARIO SIMULATION // THREAT CLASSIFICATION
          </span>
        </div>

        {/* POV viewport */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {selectedCamera ? (
            <>
              {/* Base camera POV */}
              <div style={{ position: "absolute", inset: 0 }}>
                <CameraPovPlaceholder camera={selectedCamera} index={selectedIdx} />
              </div>

              {/* Generating overlay */}
              <AnimatePresence>
                {simState === "generating" && (
                  <motion.div
                    key="gen"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: "absolute", inset: 0, zIndex: 20 }}
                  >
                    <GeneratingOverlay />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Video result */}
              <AnimatePresence>
                {simState === "done" && videoSrc && (
                  <motion.div
                    key="video"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
                    style={{
                      position: "absolute", inset: 0, zIndex: 15,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#000",
                    }}
                  >
                    {/* Border glow */}
                    <div style={{
                      position: "absolute", inset: 0,
                      boxShadow: `inset 0 0 0 3px ${borderColor}, inset 0 0 40px ${borderColor}22`,
                      pointerEvents: "none", zIndex: 5,
                    }} />

                    <video
                      ref={videoRef}
                      key={videoSrc}
                      src={videoSrc}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />

                    {/* Violence alert overlay */}
                    {classification === "fight" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                        style={{
                          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
                          zIndex: 10,
                          background: "rgba(239,68,68,0.15)",
                          border: "1px solid rgba(239,68,68,0.6)",
                          borderRadius: 6,
                          padding: "10px 24px",
                          backdropFilter: "blur(8px)",
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", color: "#ef4444" }}>
                          VIOLENCE DETECTED
                        </span>
                      </motion.div>
                    )}

                    {/* Normal clear badge */}
                    {classification === "normal" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                        style={{
                          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
                          zIndex: 10,
                          background: "rgba(34,197,94,0.12)",
                          border: "1px solid rgba(34,197,94,0.5)",
                          borderRadius: 6,
                          padding: "10px 24px",
                          backdropFilter: "blur(8px)",
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", color: "#22c55e" }}>
                          ACTIVITY NORMAL
                        </span>
                      </motion.div>
                    )}

                    {/* Reset button */}
                    <button
                      onClick={() => { setSimState("idle"); setVideoSrc(null); setClassification(null); setPrompt(""); }}
                      style={{
                        position: "absolute", bottom: 16, right: 16, zIndex: 10,
                        padding: "6px 14px",
                        background: "rgba(10,10,10,0.8)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em",
                        cursor: "pointer",
                      }}
                    >
                      RESET
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(251,191,36,0.4)", letterSpacing: "0.2em" }}>
                NO CAMERAS PLACED
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
                GO TO PLACEMENT VIEW TO POSITION CAMERAS
              </div>
            </div>
          )}
        </div>

        {/* Prompt bar */}
        <div style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(251,191,36,0.08)",
          background: "rgba(6,6,6,0.95)",
          padding: "12px 16px",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={simState === "generating" || !selectedCamera}
            placeholder={selectedCamera ? 'Describe a scenario — type "fight" or "normal" to classify...' : "Select a camera first"}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(251,191,36,0.15)",
              borderRadius: 6,
              padding: "9px 14px",
              color: "rgba(255,255,255,0.8)",
              fontFamily: "monospace",
              fontSize: 12,
              outline: "none",
              letterSpacing: "0.04em",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={simState === "generating" || !selectedCamera || !prompt.trim()}
            style={{
              padding: "9px 20px",
              background: simState === "generating" || !selectedCamera || !prompt.trim()
                ? "rgba(251,191,36,0.06)"
                : "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: 6,
              color: simState === "generating" || !selectedCamera || !prompt.trim() ? "rgba(251,191,36,0.3)" : "#fbbf24",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              cursor: simState === "generating" || !selectedCamera || !prompt.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {simState === "generating" ? "GENERATING..." : "SIMULATE"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
