"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getPlacedCameras } from "@/lib/session";
import ModeSidebar from "@/components/ModeSidebar";

const SceneView = dynamic(
  () => import("@/components/SceneView").then((m) => m.default),
  { ssr: false }
);

const CameraView = dynamic(
  () => import("@/components/CameraView").then((m) => m.default),
  { ssr: false }
);

export default function V2BuildingPage() {
  const router = useRouter();
  const [placementMode, setPlacementMode] = useState(false);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  const cameras = typeof window !== "undefined" ? getPlacedCameras() : [];

  const handleCameraClicked = useCallback((cameraId: string) => {
    setActiveCameraId(cameraId);
  }, []);

  const handleSwitchCamera = useCallback((cameraId: string) => {
    setActiveCameraId(cameraId);
  }, []);

  const handleCloseCamera = useCallback(() => {
    setActiveCameraId(null);
  }, []);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      zIndex: 10000,
    }}>
      <ModeSidebar />

      {/* Back button */}
      <button
        onClick={() => router.push("/v2/globe")}
        style={{
          position: "absolute",
          top: 24,
          left: 64,
          zIndex: 100,
          padding: "8px 16px",
          background: "rgba(10, 10, 10, 0.8)",
          border: "1px solid rgba(0, 229, 255, 0.2)",
          borderRadius: "6px",
          color: "rgba(0, 229, 255, 0.7)",
          fontFamily: "var(--font-space-mono), monospace",
          fontSize: "11px",
          letterSpacing: "0.15em",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        ← GLOBE VIEW
      </button>

      {/* Building name */}
      <div style={{
        position: "absolute",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        textAlign: "center",
      }}>
        <span style={{
          color: "#33ccaa",
          fontFamily: "var(--font-space-mono), monospace",
          fontSize: "12px",
          letterSpacing: "0.3em",
        }}>
          HALL OF DATA SCIENCE AND AI
        </span>
        <br />
        <span style={{
          color: "#555",
          fontFamily: "var(--font-space-mono), monospace",
          fontSize: "10px",
          letterSpacing: "0.2em",
        }}>
          INTERIOR SCAN // 3D RECONSTRUCTION
        </span>
      </div>

      {/* Placement mode toggle */}
      <button
        onClick={() => setPlacementMode(!placementMode)}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          zIndex: 100,
          padding: "8px 16px",
          background: placementMode ? "rgba(0, 229, 255, 0.15)" : "rgba(10, 10, 10, 0.8)",
          border: `1px solid ${placementMode ? "rgba(0, 229, 255, 0.5)" : "rgba(255, 255, 255, 0.1)"}`,
          borderRadius: "6px",
          color: placementMode ? "#00e5ff" : "rgba(255, 255, 255, 0.5)",
          fontFamily: "var(--font-space-mono), monospace",
          fontSize: "11px",
          letterSpacing: "0.15em",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        {placementMode ? "◉ PLACING CAMERAS" : "○ PLACE CAMERAS"}
      </button>

      {/* 3D Scene */}
      <SceneView
        splatPath="/splats/dsai.spz"
        placementMode={placementMode}
        splatVisible={true}
        onCameraClicked={handleCameraClicked}
      />

      {/* Camera feed overlay — rendered on top of the world model */}
      {activeCameraId && (
        <div style={{ position: "absolute", inset: 0, zIndex: 200 }}>
          <CameraView
            cameraId={activeCameraId}
            cameras={cameras}
            building={null}
            onSwitchCamera={handleSwitchCamera}
            onClose={handleCloseCamera}
          />
        </div>
      )}
    </div>
  );
}
