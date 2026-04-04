"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSessionId } from "@/lib/session";
import {
  getCameras,
  getBuilding,
  startSimulation,
  pollSimulation,
} from "@/lib/api";
import type { Camera, Building } from "@/lib/types";
import CameraView from "@/components/CameraView";
import VideoOverlay from "@/components/VideoOverlay";

export default function CameraPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cameraId = params.id;

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Load cameras and building on mount
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) {
      router.push("/");
      return;
    }

    const load = async () => {
      try {
        const [camerasRes, buildingRes] = await Promise.all([
          getCameras(sessionId),
          getBuilding(sessionId),
        ]);
        setCameras(camerasRes.cameras);
        setBuilding(buildingRes.building);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load camera data";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // Handle simulation submission
  const handleSimulationSubmit = useCallback(
    async (prompt: string) => {
      const sessionId = getSessionId();
      if (!sessionId || !cameraId) return;

      setIsSimulating(true);
      setVideoUrl(null);

      try {
        await startSimulation(sessionId, cameraId, prompt);

        const stopPolling = pollSimulation(sessionId, cameraId, (result) => {
          if (result.status === "complete" && result.video_url) {
            setIsSimulating(false);
            setVideoUrl(result.video_url);
            stopPolling();
          } else if (result.status === "failed") {
            setIsSimulating(false);
            setError(result.error ?? "Simulation failed");
            stopPolling();
          }
        });
      } catch (err: unknown) {
        setIsSimulating(false);
        const message =
          err instanceof Error ? err.message : "Failed to start simulation";
        setError(message);
      }
    },
    [cameraId]
  );

  // Handle camera switching
  const handleSwitchCamera = useCallback(
    (newCameraId: string) => {
      if (newCameraId !== cameraId) {
        router.push(`/camera/${newCameraId}`, { scroll: false });
      }
    },
    [cameraId, router]
  );

  // Handle video overlay close
  const handleCloseVideo = useCallback(() => {
    setVideoUrl(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <main
        className="relative flex flex-col items-center justify-center min-h-screen"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <div
          className="glow-cyan font-mono text-sm tracking-[0.3em] uppercase hud-pulse"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-accent-cyan)",
          }}
        >
          ESTABLISHING CAMERA FEED
        </div>
        <div
          className="font-mono text-xs mt-4 tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-dim)",
          }}
        >
          CAM-{cameraId}
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main
        className="relative flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <div
          className="font-mono text-sm tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "#ff2d2d",
          }}
        >
          ERROR
        </div>
        <div
          className="font-mono text-xs tracking-[0.1em] max-w-md text-center"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-dim)",
          }}
        >
          {error}
        </div>
        <button
          type="button"
          onClick={() => router.push("/building")}
          style={{
            marginTop: 16,
            background: "rgba(0, 229, 255, 0.08)",
            border: "1px solid rgba(0, 229, 255, 0.25)",
            borderRadius: 3,
            padding: "8px 20px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--color-accent-cyan)",
            cursor: "pointer",
          }}
        >
          BACK TO BUILDING
        </button>
      </main>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/building")}
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          background: "rgba(0, 0, 0, 0.7)",
          border: "1px solid rgba(0, 229, 255, 0.2)",
          borderRadius: 3,
          padding: "6px 18px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.25em",
          color: "var(--color-accent-cyan)",
          cursor: "pointer",
          backdropFilter: "blur(4px)",
          transition:
            "background var(--duration-fast) ease, border-color var(--duration-fast) ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.background = "rgba(0, 229, 255, 0.1)";
          el.style.borderColor = "rgba(0, 229, 255, 0.4)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.background = "rgba(0, 0, 0, 0.7)";
          el.style.borderColor = "rgba(0, 229, 255, 0.2)";
        }}
      >
        &larr; BACK TO BUILDING
      </button>

      <CameraView
        cameraId={cameraId}
        cameras={cameras}
        building={building}
        onSwitchCamera={handleSwitchCamera}
        onSimulationSubmit={handleSimulationSubmit}
        isSimulating={isSimulating}
      />

      {/* Video Overlay */}
      {videoUrl && (
        <VideoOverlay videoUrl={videoUrl} onClose={handleCloseVideo} />
      )}
    </motion.main>
  );
}
