"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModeSidebar from "@/components/ModeSidebar";
import type { Camera } from "@/lib/types";

// ── Hardcoded cameras (same as building page) ────────────────────────────────
const HARDCODED_CAMERAS: Camera[] = [
  { id: "cam_h1", building_id: "dsai", position: { x: -5.54, y: -1.00, z: 15.87 }, rotation: { yaw: 270.97, pitch: -15 }, fov: 90, coverage_radius: 10, placement_score: 1.0 },
  { id: "cam_h2", building_id: "dsai", position: { x: -3.93, y: -0.89, z: 13.34 }, rotation: { yaw: 181.08, pitch: -15 }, fov: 90, coverage_radius: 10, placement_score: 1.0 },
  { id: "cam_h3", building_id: "dsai", position: { x:  0.05, y: -0.86, z: 15.19 }, rotation: { yaw: 181.01, pitch: -15 }, fov: 90, coverage_radius: 10, placement_score: 1.0 },
  { id: "cam_h4", building_id: "dsai", position: { x:  4.71, y: -1.06, z: 19.20 }, rotation: { yaw:  17.93, pitch: -15 }, fov: 90, coverage_radius: 10, placement_score: 1.0 },
];

// Screenshot shown before any simulation
const CAM_SCREENSHOTS: Record<string, string> = {
  cam_h1: "/camera-screenshots/cam_h1.png",
  cam_h2: "/camera-screenshots/cam_h2.png",
  cam_h3: "/camera-screenshots/cam_h3.png",
  cam_h4: "/camera-screenshots/cam_h4.png",
};

// Per-camera video pools (fight = disturbance|theft, normal = normal_traffic)
// cam-01→cam2-2, cam-02→cam1, cam-03→cam3-2, cam-04→cam4
const FIGHT_POOLS: string[][] = [
  // cam_h1 → cam2-2 prefix
  ["cam2-2__daylight_disturbance.mp4","cam2-2__daylight_theft.mp4","cam2-2__dusk_disturbance.mp4",
   "cam2-2__dusk_theft.mp4","cam2-2__night_disturbance.mp4","cam2-2__night_theft.mp4",
   "cam2-2__overcast_disturbance.mp4","cam2-2__overcast_theft.mp4"],
  // cam_h2 → cam1 prefix
  ["cam1__daylight_disturbance.mp4","cam1__daylight_theft.mp4","cam1__dusk_disturbance.mp4",
   "cam1__dusk_theft.mp4","cam1__night_disturbance.mp4","cam1__night_theft.mp4",
   "cam1__overcast_disturbance.mp4","cam1__overcast_theft.mp4"],
  // cam_h3 → cam3-2 prefix
  ["cam3-2__daylight_disturbance.mp4","cam3-2__daylight_theft.mp4","cam3-2__dusk_disturbance.mp4",
   "cam3-2__dusk_theft.mp4","cam3-2__night_disturbance.mp4","cam3-2__night_theft.mp4",
   "cam3-2__overcast_disturbance.mp4","cam3-2__overcast_theft.mp4"],
  // cam_h4 → cam4 prefix
  ["cam4__daylight_disturbance.mp4","cam4__daylight_theft.mp4","cam4__dusk_disturbance.mp4",
   "cam4__dusk_theft.mp4","cam4__night_disturbance.mp4","cam4__night_theft.mp4",
   "cam4__overcast_disturbance.mp4","cam4__overcast_theft.mp4"],
];

const NORMAL_POOLS: string[][] = [
  ["cam2-2__daylight_normal_traffic.mp4","cam2-2__dusk_normal_traffic.mp4","cam2-2__night_normal_traffic.mp4","cam2-2__overcast_normal_traffic.mp4"],
  ["cam1__daylight_normal_traffic.mp4","cam1__dusk_normal_traffic.mp4","cam1__night_normal_traffic.mp4","cam1__overcast_normal_traffic.mp4"],
  ["cam3-2__daylight_normal_traffic.mp4","cam3-2__dusk_normal_traffic.mp4","cam3-2__night_normal_traffic.mp4","cam3-2__overcast_normal_traffic.mp4"],
  ["cam4__daylight_normal_traffic.mp4","cam4__dusk_normal_traffic.mp4","cam4__night_normal_traffic.mp4","cam4__overcast_normal_traffic.mp4"],
];

function pickVideo(isFight: boolean, camIdx: number): string {
  const pool = isFight ? FIGHT_POOLS[camIdx % FIGHT_POOLS.length] : NORMAL_POOLS[camIdx % NORMAL_POOLS.length];
  return "/training-videos/" + pool[Math.floor(Math.random() * pool.length)];
}

type SimState = "idle" | "generating" | "done";

// ── Generating overlay ───────────────────────────────────────────────────────
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
  }, [steps.length]);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(2px)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: "2px solid rgba(0,229,255,0.12)", borderTopColor: "#00e5ff",
        animation: "ev-spin 0.9s linear infinite", marginBottom: 24,
      }} />
      <div style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 11, letterSpacing: "0.3em", color: "#00e5ff", marginBottom: 20, fontWeight: 700 }}>
        GENERATING SYNTHETIC SCENARIO{dots}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start", minWidth: 280 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            fontFamily: "var(--font-space-mono, monospace)", fontSize: 9, letterSpacing: "0.08em",
            color: i <= step ? "rgba(0,229,255,0.9)" : "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", gap: 8, transition: "color 0.3s",
          }}>
            <span style={{ color: i < step ? "#00e5ff" : i === step ? "#00e5ff" : "rgba(255,255,255,0.1)" }}>
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

// ── Main page ────────────────────────────────────────────────────────────────
export default function EvaluatePage() {
  const cameras = HARDCODED_CAMERAS;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [simState, setSimState] = useState<SimState>("idle");
  const [classification, setClassification] = useState<"fight" | "normal" | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selectedCamera = cameras[selectedIdx];
  const screenshot = CAM_SCREENSHOTS[selectedCamera.id];

  const handleSelectCamera = (idx: number) => {
    setSelectedIdx(idx);
    setSimState("idle");
    setVideoSrc(null);
    setClassification(null);
  };

  const handleSubmit = () => {
    if (!prompt.trim()) return;

    const isFight = prompt.toLowerCase().includes("fight");
    const cls: "fight" | "normal" = isFight ? "fight" : "normal";

    setSimState("generating");
    setVideoSrc(null);
    setClassification(null);

    const src = pickVideo(isFight, selectedIdx);
    const delay = 5000 + Math.random() * 5000;

    setTimeout(() => {
      setVideoSrc(src);
      setClassification(cls);
      setSimState("done");
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const borderColor = classification === "fight" ? "#ef4444" : classification === "normal" ? "#10b981" : "rgba(0,229,255,0.15)";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}
      style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0e14", display: "flex" }}
    >
      <ModeSidebar />

      {/* Camera list panel */}
      <div style={{
        position: "absolute", top: 0, left: 48, bottom: 0, width: 200,
        borderRight: "1px solid rgba(0,229,255,0.08)",
        background: "rgba(6,6,6,0.95)",
        display: "flex", flexDirection: "column", zIndex: 10,
      }}>
        <div style={{ height: 40, display: "flex", alignItems: "center", paddingLeft: 14, borderBottom: "1px solid rgba(0,229,255,0.08)" }}>
          <span style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 9, letterSpacing: "0.25em", color: "#00e5ff" }}>
            CAMERAS ({cameras.length})
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cameras.map((cam, i) => {
            const active = i === selectedIdx;
            const thumb = CAM_SCREENSHOTS[cam.id];
            return (
              <button key={cam.id} onClick={() => handleSelectCamera(i)} style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 14px",
                background: active ? "rgba(0,229,255,0.08)" : "transparent",
                border: "none", borderLeft: active ? "2px solid #00e5ff" : "2px solid transparent",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                {/* Thumbnail */}
                <div style={{
                  width: 36, height: 28, borderRadius: 4, flexShrink: 0, overflow: "hidden",
                  background: "rgba(255,255,255,0.04)",
                  border: active ? "1px solid rgba(0,229,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
                }}>
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7)" }} />
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 10, color: active ? "#00e5ff" : "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>
                    CAM {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em", marginTop: 2 }}>
                    {(cam.placement_score * 100).toFixed(0)}% CVG
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", top: 0, left: 248, right: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(0,229,255,0.08)", background: "rgba(6,6,6,0.9)", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 10, letterSpacing: "0.3em", color: "#00e5ff" }}>
            EVALUATE // SCENARIO SIMULATION // THREAT CLASSIFICATION
          </span>
        </div>

        {/* POV viewport */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Default: camera screenshot */}
          <AnimatePresence>
            {simState === "idle" && (
              <motion.div key="screenshot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: "absolute", inset: 0 }}>
                {screenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={screenshot} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.65) contrast(1.1)" }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, background: "#050505" }} />
                )}
                {/* Scanlines */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)" }} />
                {/* HUD */}
                <div style={{ position: "absolute", top: 10, left: 12, fontFamily: "var(--font-space-mono, monospace)", fontSize: 10, color: "rgba(0,229,255,0.6)", letterSpacing: "0.1em" }}>
                  CAM {String(selectedIdx + 1).padStart(2, "0")} // FOV {selectedCamera.fov.toFixed(0)}°
                </div>
                <div style={{ position: "absolute", top: 10, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <RecDot />
                  <span style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 10, color: "#ef4444", letterSpacing: "0.1em" }}>REC</span>
                </div>
                <div style={{ position: "absolute", bottom: 10, left: 12, fontFamily: "var(--font-space-mono, monospace)", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>
                  YAW {selectedCamera.rotation.yaw.toFixed(1)}° · PITCH {selectedCamera.rotation.pitch.toFixed(1)}°
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generating overlay */}
          <AnimatePresence>
            {simState === "generating" && (
              <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: "absolute", inset: 0, zIndex: 20 }}>
                <GeneratingOverlay />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Video result */}
          <AnimatePresence>
            {simState === "done" && videoSrc && (
              <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
                style={{ position: "absolute", inset: 0, zIndex: 15, background: "#000" }}>
                {/* Border glow */}
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5,
                  boxShadow: `inset 0 0 0 3px ${borderColor}, inset 0 0 40px ${borderColor}22`,
                }} />
                <video ref={videoRef} key={videoSrc} src={videoSrc} autoPlay loop muted playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                {/* Violence alert */}
                {classification === "fight" && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                    style={{
                      position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10,
                      background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.6)",
                      borderRadius: 6, padding: "10px 24px", backdropFilter: "blur(8px)",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", color: "#ef4444" }}>
                      VIOLENCE DETECTED
                    </span>
                  </motion.div>
                )}

                {/* Clear badge */}
                {classification === "normal" && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                    style={{
                      position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10,
                      background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.5)",
                      borderRadius: 6, padding: "10px 24px", backdropFilter: "blur(8px)",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span style={{ fontFamily: "var(--font-space-mono, monospace)", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", color: "#10b981" }}>
                      ACTIVITY NORMAL
                    </span>
                  </motion.div>
                )}

                <button onClick={() => { setSimState("idle"); setVideoSrc(null); setClassification(null); setPrompt(""); }}
                  style={{
                    position: "absolute", bottom: 16, right: 16, zIndex: 10,
                    padding: "6px 14px", background: "rgba(10,10,10,0.8)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                    color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-space-mono, monospace)",
                    fontSize: 9, letterSpacing: "0.15em", cursor: "pointer",
                  }}>
                  RESET
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation message */}
          <AnimatePresence>
            {validationMsg && (
              <motion.div key="val" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  position: "absolute", bottom: 70, left: "50%", transform: "translateX(-50%)", zIndex: 30,
                  background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)",
                  borderRadius: 4, padding: "6px 14px",
                  fontFamily: "var(--font-space-mono, monospace)", fontSize: 9, letterSpacing: "0.15em", color: "#fbbf24",
                }}>
                {validationMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Prompt bar */}
        <div style={{
          flexShrink: 0, borderTop: "1px solid rgba(0,229,255,0.08)",
          background: "rgba(6,6,6,0.95)", padding: "12px 16px",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={simState === "generating"}
            placeholder='Describe a scenario — include "fight" for violence detection...'
            style={{
              flex: 1, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(0,229,255,0.15)", borderRadius: 6,
              padding: "9px 14px", color: "rgba(255,255,255,0.8)",
              fontFamily: "var(--font-space-mono, monospace)", fontSize: 12,
              outline: "none", letterSpacing: "0.04em",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={simState === "generating" || !prompt.trim()}
            style={{
              padding: "9px 20px",
              background: simState === "generating" || !prompt.trim() ? "rgba(0,229,255,0.06)" : "rgba(0,229,255,0.15)",
              border: "1px solid rgba(0,229,255,0.3)", borderRadius: 6,
              color: simState === "generating" || !prompt.trim() ? "rgba(0,229,255,0.3)" : "#00e5ff",
              fontFamily: "var(--font-space-mono, monospace)", fontSize: 10, letterSpacing: "0.15em",
              cursor: simState === "generating" || !prompt.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s", whiteSpace: "nowrap",
            }}>
            {simState === "generating" ? "GENERATING..." : "SIMULATE"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Blinking REC dot
function RecDot() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      width: 7, height: 7, borderRadius: "50%", display: "inline-block",
      background: on ? "#ef4444" : "transparent",
      border: "1px solid #ef4444", transition: "background 0.1s",
    }} />
  );
}
