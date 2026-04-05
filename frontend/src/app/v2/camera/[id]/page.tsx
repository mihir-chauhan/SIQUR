"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const CameraView = dynamic(
  () => import("@/components/CameraView").then((m) => m.default),
  { ssr: false }
);

export default function V2CameraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isSimulating, setIsSimulating] = useState(false);

  // Read cameras from localStorage
  const storedCameras = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("minority_report_placed_cameras") || "[]")
    : [];

  const handleSwitchCamera = useCallback((cameraId: string) => {
    router.push(`/v2/camera/${cameraId}`);
  }, [router]);

  const handleSimulationSubmit = useCallback((prompt: string) => {
    setIsSimulating(true);
    // Simulation would call API here
    setTimeout(() => setIsSimulating(false), 3000);
  }, []);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      zIndex: 10000,
    }}>
      {/* Back button */}
      <button
        onClick={() => router.push("/v2/building")}
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
        ← BUILDING VIEW
      </button>

      <CameraView
        cameraId={id}
        cameras={storedCameras}
        building={null}
        onSwitchCamera={handleSwitchCamera}
        onSimulationSubmit={handleSimulationSubmit}
        isSimulating={isSimulating}
      />
    </div>
  );
}
