"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import ModeSidebar from "@/components/ModeSidebar";
import type { SceneHandle } from "@/components/SceneView";

const SceneView = dynamic(() => import("@/components/SceneView"), {
  ssr: false,
});

/**
 * Watchman — synchronized motion tracking viewer.
 * Left: OBJ interior via SceneView (same component as placement, no splat, no cameras).
 * Right: 4 stacked video feeds (placeholder until videos provided).
 */

// Hardcoded video paths — update these when videos are provided
const VIDEO_FEEDS = [
  { id: "cam_h1", label: "CAM-H1", src: "" },
  { id: "cam_h2", label: "CAM-H2", src: "" },
  { id: "cam_h3", label: "CAM-H3", src: "" },
  { id: "cam_h4", label: "CAM-H4", src: "" },
];

export default function WatchmanPage() {
  const [sceneReady, setSceneReady] = useState(false);
  const sceneHandleRef = useRef<SceneHandle | null>(null);
  const [camData, setCamData] = useState({ x: 0, y: 0, z: 0, yaw: 0 });

  // Poll camera position/rotation at 10fps
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      const data = sceneHandleRef.current?.captureCamera();
      if (data) {
        setCamData({ x: data.position.x, y: data.position.y, z: data.position.z, yaw: data.yaw });
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0e14",
      }}
    >
      {/* Mode switcher (far left) */}
      <ModeSidebar />

      {/* Loading overlay */}
      {!sceneReady && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 48,
            right: 0,
            bottom: 0,
            zIndex: 50,
            background: "radial-gradient(ellipse at center, rgba(0, 20, 30, 0.95) 0%, rgba(10, 10, 10, 0.98) 70%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid rgba(0, 229, 255, 0.15)",
              borderTopColor: "rgba(0, 229, 255, 0.8)",
              animation: "wm-spin 1s linear infinite",
              marginBottom: 20,
              boxShadow: "0 0 20px rgba(0, 229, 255, 0.15)",
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "#00e5ff",
              textShadow: "0 0 12px rgba(0, 229, 255, 0.4)",
            }}
          >
            INITIALIZING WATCHMAN
          </div>
          <style>{`
            @keyframes wm-spin { to { transform: rotate(360deg); } }
            @keyframes pulse-connect { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
          `}</style>
        </div>
      )}

      {/* Main content area */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 48,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid rgba(0, 229, 255, 0.1)",
            background: "rgba(6, 6, 6, 0.9)",
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: 11,
              letterSpacing: "0.3em",
              color: "rgba(0, 229, 255, 0.6)",
            }}
          >
            WATCHMAN // MOTION TRACKING // HALL OF DATA SCIENCE AND AI
          </span>
        </div>

        {/* Split view */}
        <div style={{ flex: 1, display: "flex", position: "relative" }}>
          {/* Left: 3D OBJ Viewer (70%) — reuses SceneView directly */}
          <div style={{ width: "70%", height: "100%", position: "relative" }}>
            <SceneView
              splatPath="/splats/dsai.spz"
              objPath="/models/interior/4_4_2026.obj"
              mtlPath="/models/interior/4_4_2026.mtl"
              splatVisible={false}
              objVisible={true}
              objPosition={{ x: -1.65, y: -0.6, z: 16.9 }}
              objRotation={{ x: 0, y: -267.5, z: 0 }}
              objScale={{ x: 0.25, y: 0.25, z: 0.25 }}
              sceneRef={sceneHandleRef}
              initialCameraPos={[1.37, -0.47, 7.49]}
              initialCameraLookAt={[1.37, 0.5, 9.0]}
              onSplatLoaded={() => setSceneReady(true)}
            />

            {/* Camera coordinates overlay */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                fontFamily: "var(--font-space-mono, monospace)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "var(--color-text-dim, rgba(255,255,255,0.4))",
                pointerEvents: "none",
              }}
            >
              <span>
                X: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.x.toFixed(2)}</span>
              </span>
              <span>
                Y: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.y.toFixed(2)}</span>
              </span>
              <span>
                Z: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.z.toFixed(2)}</span>
              </span>
              <span style={{ marginTop: 4 }}>
                YAW: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.yaw.toFixed(1)}</span>&deg;
              </span>
            </div>
          </div>

          {/* Right: Video feeds (30%) */}
          <div
            style={{
              width: "30%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid rgba(0, 229, 255, 0.1)",
            }}
          >
            {VIDEO_FEEDS.map((feed) => (
              <div
                key={feed.id}
                style={{
                  flex: 1,
                  position: "relative",
                  borderBottom: "1px solid rgba(0, 229, 255, 0.08)",
                  background: "rgba(10, 14, 20, 0.95)",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
                  backgroundSize: "150px 150px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {/* Corner brackets */}
                <span style={{ position: "absolute", top: 4, left: 4, width: 12, height: 12, borderTop: "1px solid rgba(0, 229, 255, 0.3)", borderLeft: "1px solid rgba(0, 229, 255, 0.3)" }} />
                <span style={{ position: "absolute", top: 4, right: 4, width: 12, height: 12, borderTop: "1px solid rgba(0, 229, 255, 0.3)", borderRight: "1px solid rgba(0, 229, 255, 0.3)" }} />
                <span style={{ position: "absolute", bottom: 4, left: 4, width: 12, height: 12, borderBottom: "1px solid rgba(0, 229, 255, 0.3)", borderLeft: "1px solid rgba(0, 229, 255, 0.3)" }} />
                <span style={{ position: "absolute", bottom: 4, right: 4, width: 12, height: 12, borderBottom: "1px solid rgba(0, 229, 255, 0.3)", borderRight: "1px solid rgba(0, 229, 255, 0.3)" }} />

                {/* Camera label */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 10,
                    fontFamily: "var(--font-space-mono, monospace)",
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    color: "rgba(0, 229, 255, 0.5)",
                  }}
                >
                  {feed.label}
                </div>

                {/* Connecting state */}
                {!feed.src && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1">
                      <rect x="2" y="3" width="20" height="18" rx="2" />
                      <line x1="2" y1="3" x2="22" y2="21" />
                    </svg>
                    <span
                      style={{
                        fontFamily: "var(--font-space-mono, monospace)",
                        fontSize: 8,
                        letterSpacing: "0.2em",
                        color: "rgba(0, 229, 255, 0.25)",
                        animation: "pulse-connect 2s ease-in-out infinite",
                      }}
                    >
                      CONNECTING...
                    </span>
                  </div>
                )}

                {/* Video element — rendered when src provided */}
                {feed.src && (
                  <video
                    src={feed.src}
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
