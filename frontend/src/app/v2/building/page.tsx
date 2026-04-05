"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const SceneView = dynamic(
  () => import("@/components/SceneView").then((m) => m.default),
  { ssr: false }
);

export default function V2BuildingPage() {
  const router = useRouter();
  const [placementMode, setPlacementMode] = useState(false);

  const handleCameraClicked = useCallback((cameraId: string) => {
    router.push(`/v2/camera/${cameraId}`);
  }, [router]);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      zIndex: 10000,
    }}>
      {/* Back button */}
      <button
        onClick={() => router.push("/v2")}
        style={{
          position: "absolute",
          top: 24,
          left: 24,
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
    </div>
  );
}
