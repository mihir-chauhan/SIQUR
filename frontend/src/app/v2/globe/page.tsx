"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";

const MapboxGlobe = dynamic(
  () => import("@/components/ui/mapbox-globe").then((m) => m.MapboxGlobe),
  { ssr: false }
);

const LocationMap = dynamic(
  () => import("@/components/ui/expand-map").then((m) => m.LocationMap),
  { ssr: false }
);

const PURDUE_MARKERS = [
  { id: "hall-ds-ai", location: [40.42900376167204, -86.91475612331323] as [number, number], delay: 0 },
  { id: "purdue-lawson", location: [40.4278, -86.9170] as [number, number], delay: 0.3 },
  { id: "purdue-pmu", location: [40.4247, -86.9106] as [number, number], delay: 0.6 },
  { id: "purdue-armstrong", location: [40.4314, -86.9193] as [number, number], delay: 0.9 },
];

const LOCATION_DB: Record<string, { name: string; coordinates: string }> = {
  "hall-ds-ai": { name: "Hall of Data Science and AI", coordinates: "40.4290° N, 86.9148° W" },
  "purdue-lawson": { name: "Lawson Computer Science Building", coordinates: "40.4278° N, 86.9170° W" },
  "purdue-pmu": { name: "Purdue Memorial Union", coordinates: "40.4247° N, 86.9106° W" },
  "purdue-armstrong": { name: "Hall of Data Science and AI", coordinates: "40.4314° N, 86.9193° W" },
};

export default function GlobePage() {
  const [globePaused, setGlobePaused] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [activeTarget, setActiveTarget] = useState<{
    id: string; name: string; coordinates: string; location: [number, number];
  } | null>(null);
  const [restrictedToast, setRestrictedToast] = useState<string | null>(null);

  const triggerZoom = useCallback((location: [number, number]) => {
    setGlobePaused(true);
    setFlyToTarget(location);
  }, []);

  const handleMarkerClick = useCallback(
    (marker: { id: string; location: [number, number] }) => {
      if (activeTarget) return;
      if (marker.id !== "hall-ds-ai") {
        setRestrictedToast(marker.id);
        setTimeout(() => setRestrictedToast(null), 2500);
        return;
      }
      const data = LOCATION_DB[marker.id] || { name: "Unknown", coordinates: "N/A" };
      setActiveTarget({ ...marker, ...data });
      triggerZoom(marker.location);
    },
    [activeTarget, triggerZoom]
  );

  const handleFlyToComplete = useCallback(() => {
    setShowLocationPanel(true);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 10000, overflow: "hidden", fontSize: "110%" }}>
      {/* Globe */}
      <div style={{ position: "absolute", inset: 0 }}>
        <MapboxGlobe
          token="pk.eyJ1IjoibWloaXJjIiwiYSI6ImNtYnhoZ2wxYjBkdWsybG9rMnptcDI5NDQifQ.I3WBvKmQnyux7qBz3hXJ1w"
          markers={PURDUE_MARKERS}
          paused={globePaused}
          onMarkerClick={handleMarkerClick}
          flyToTarget={flyToTarget}
          onFlyToComplete={handleFlyToComplete}
        />
      </div>

      {/* HUD Content */}
      <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none", padding: "32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ marginBottom: "6px" }}>
              <span style={{ fontFamily: "var(--font-display), system-ui, sans-serif", fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "var(--leading-tight)" }}>
                {"SIQUR".split("").map((ch, i) => (
                  <span key={i} style={{ color: ch === "I" || ch === "Q" ? "#00e5ff" : "#fff" }}>{ch}</span>
                ))}
              </span>
            </div>
            <span style={{ color: "rgba(0, 229, 255, 0.4)", fontFamily: "var(--font-space-mono), monospace", fontSize: "var(--text-md)", letterSpacing: "var(--tracking-wide)" }}>
              see everything. miss nothing.
            </span>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#00e5ff", fontFamily: "var(--font-space-mono), monospace", fontSize: "var(--text-base)", letterSpacing: "var(--tracking-wide)", marginBottom: "4px" }}>
              SYSTEM_STATUS: <span style={{ color: "#10b981" }}>ACTIVE</span>
            </div>
            <div style={{ color: "#444", fontFamily: "var(--font-space-mono), monospace", fontSize: "var(--text-sm)", letterSpacing: "var(--tracking-wide)" }}>
              OR_TOOLS_COMPUTE_GRID: ONLINE
            </div>
          </div>
        </div>

        {/* Middle Section: Coordinates & Stats */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flex: 1 }}>
          {/* Left Sidebar: Live Coordinates */}
          <div style={{ width: "220px", padding: "20px", background: "linear-gradient(90deg, rgba(0, 229, 255, 0.05) 0%, transparent 100%)", borderLeft: "1px solid rgba(0, 229, 255, 0.2)", pointerEvents: "auto" }}>
            <div style={{ color: "#00e5ff", fontSize: "var(--text-sm)", fontFamily: "var(--font-space-mono), monospace", marginBottom: "12px", borderBottom: "1px solid rgba(0, 229, 255, 0.2)", paddingBottom: "4px", letterSpacing: "var(--tracking-wide)" }}>
              ACTIVE COORDINATES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {PURDUE_MARKERS.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleMarkerClick(m)}
                  style={{
                    cursor: m.id === "hall-ds-ai" ? "pointer" : "not-allowed",
                    opacity: 1,
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ color: "#00e5ff", fontSize: "var(--text-sm)", fontFamily: "var(--font-space-mono), monospace" }}>
                    ID: {m.id.toUpperCase()}
                  </div>
                  <div style={{ color: "rgba(0, 229, 255, 0.6)", fontSize: "var(--text-xs)", fontFamily: "var(--font-space-mono), monospace" }}>
                    {m.location[0].toFixed(4)}N, {Math.abs(m.location[1]).toFixed(4)}W
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Section: Tactical View */}
          <div style={{ width: "160px", textAlign: "right", padding: "20px", opacity: 0.6 }}>
            <div style={{ color: "#00e5ff", fontSize: "var(--text-xs)", fontFamily: "var(--font-space-mono), monospace", marginBottom: "8px", letterSpacing: "var(--tracking-wide)" }}>CURRENT LOCATION</div>
            <div style={{ fontSize: "var(--text-sm)", color: "#666", fontFamily: "var(--font-space-mono), monospace", lineHeight: "var(--leading-relaxed)" }}>
              LAT: 40.4290<br/>
              LNG: -86.9148<br/>
              ALT: 187M
            </div>
          </div>
        </div>

        {/* Bottom Section: Building Data */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ width: "420px", background: "rgba(0,0,0,0.5)", padding: "16px", border: "1px solid rgba(0, 229, 255, 0.1)", backdropFilter: "blur(4px)", borderRadius: "2px" }}>
            <div style={{ color: "#00e5ff", fontSize: "var(--text-sm)", fontFamily: "var(--font-space-mono), monospace", marginBottom: "10px", borderBottom: "1px solid rgba(0, 229, 255, 0.15)", paddingBottom: "6px", letterSpacing: "var(--tracking-wider)" }}>SITE OVERVIEW</div>
            <div style={{ fontSize: "var(--text-base)", fontFamily: "var(--font-space-mono), monospace", color: "rgba(0, 229, 255, 0.5)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>BUILDINGS RENDERED</span>
                <span style={{ color: "#00e5ff" }}>4</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>BUILDINGS AVAILABLE</span>
                <span style={{ color: "#10b981" }}>1</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>3D SCANS LOADED</span>
                <span style={{ color: "#00e5ff" }}>1</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>IMAGES CAPTURED</span>
                <span style={{ color: "#00e5ff" }}>847</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location panel */}
      {showLocationPanel && activeTarget && (
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: "64px", zIndex: 10, pointerEvents: "auto" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTarget.id}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ boxShadow: "0 25px 50px rgba(16,185,129,0.15)", borderRadius: "16px" }}
            >
              <LocationMap
                location={activeTarget.name}
                coordinates={activeTarget.coordinates}
                onClose={() => {
                  setActiveTarget(null);
                  setShowLocationPanel(false);
                }}
              />
              <button
                onClick={() => { window.location.href = "/building"; }}
                style={{
                  marginTop: "12px", width: "100%", padding: "10px 16px",
                  background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.25)",
                  borderRadius: "8px", color: "#00e5ff",
                  fontFamily: "var(--font-space-mono), monospace", fontSize: "13px",
                  letterSpacing: "0.2em", cursor: "pointer", textTransform: "uppercase" as const,
                }}
              >
                ▶ PLACE CAMERAS
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Restricted toast */}
      {restrictedToast && (
        <div style={{
          position: "absolute", bottom: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 20,
          padding: "12px 24px", background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,60,60,0.3)",
          borderRadius: "8px", fontFamily: "var(--font-space-mono), monospace", fontSize: "13px",
          color: "rgba(255,60,60,0.8)", letterSpacing: "0.15em", textTransform: "uppercase" as const,
        }}>
          ⚠ {restrictedToast} // CLASSIFIED — ACCESS RESTRICTED
        </div>
      )}
    </div>
  );
}
