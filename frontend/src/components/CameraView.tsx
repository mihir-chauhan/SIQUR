"use client";

import { useEffect, useRef, useState } from "react";
import type { Camera, Building } from "@/lib/types";
import FNAFSwitcher from "./FNAFSwitcher";
import SimulationPrompt from "./SimulationPrompt";

interface CameraViewProps {
  cameraId: string;
  cameras: Camera[];
  building: Building | null;
  onSwitchCamera: (cameraId: string) => void;
  onSimulationSubmit: (prompt: string) => void;
  isSimulating: boolean;
}

export default function CameraView({
  cameraId,
  cameras,
  building,
  onSwitchCamera,
  onSimulationSubmit,
  isSimulating,
}: CameraViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<unknown>(null);
  const viewerRef = useRef<unknown>(null);
  const threeCameraRef = useRef<unknown>(null);
  const frameIdRef = useRef<number>(0);
  const sceneInitialized = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [timestamp, setTimestamp] = useState("");

  const camera = cameras.find((c) => c.id === cameraId) ?? null;

  // Update timestamp every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimestamp(
        now.toISOString().replace("T", " ").slice(0, 19) + " UTC"
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Three.js and Gaussian Splats viewer ONCE (scene persists across camera switches)
  useEffect(() => {
    if (!containerRef.current || !building || sceneInitialized.current) return;

    sceneInitialized.current = true;
    let disposed = false;

    const initViewer = async () => {
      try {
        const THREE = await import("three");
        const GaussianSplats3DModule = await import(
          "@mkkellogg/gaussian-splats-3d"
        );
        const GaussianSplats3D =
          GaussianSplats3DModule.default ?? GaussianSplats3DModule;

        if (disposed || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Create scene, camera, renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);

        const threeCamera = new THREE.PerspectiveCamera(
          camera?.fov ?? 75,
          width / height,
          0.1,
          1000
        );
        threeCameraRef.current = threeCamera;

        // Set initial camera position from camera data
        if (camera) {
          threeCamera.position.set(
            camera.position.x,
            camera.position.y,
            camera.position.z
          );
          const yawRad = THREE.MathUtils.degToRad(camera.rotation.yaw);
          const pitchRad = THREE.MathUtils.degToRad(camera.rotation.pitch);
          threeCamera.rotation.set(pitchRad, yawRad, 0, "YXZ");
        }

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Try to load the splat viewer
        const splatUrl = `/splats/${building.splat_asset}`;

        try {
          const viewer = new GaussianSplats3D.Viewer({
            scene,
            renderer,
            camera: threeCamera,
            selfDrivenMode: false,
            useBuiltInControls: true,
          });

          await viewer.addSplatScene(splatUrl, {
            showLoadingUI: false,
          });

          viewerRef.current = viewer;

          if (disposed) {
            viewer.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
              container.removeChild(renderer.domElement);
            }
            return;
          }

          // Render loop — persists across camera switches
          const animate = () => {
            if (disposed) return;
            frameIdRef.current = requestAnimationFrame(animate);
            viewer.update();
            viewer.render();
          };
          animate();
        } catch {
          // Splat file failed to load, show fallback
          if (!disposed) {
            setLoadError(true);
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
              container.removeChild(renderer.domElement);
            }
          }
        }
      } catch {
        // Three.js or module import failed
        if (!disposed) {
          setLoadError(true);
        }
      }
    };

    initViewer();

    return () => {
      disposed = true;
      sceneInitialized.current = false;
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      const viewer = viewerRef.current as { dispose?: () => void } | null;
      if (viewer?.dispose) {
        try {
          viewer.dispose();
        } catch {
          // ignore disposal errors
        }
      }
      const renderer = rendererRef.current as {
        dispose?: () => void;
        domElement?: HTMLCanvasElement;
      } | null;
      if (renderer?.dispose) {
        renderer.dispose();
      }
      if (
        renderer?.domElement &&
        containerRef.current?.contains(renderer.domElement)
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }
      viewerRef.current = null;
      rendererRef.current = null;
      threeCameraRef.current = null;
    };
  // Only depends on building — NOT cameraId. Scene is created once per building.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building]);

  // When cameraId changes, only update the Three.js camera position/rotation
  useEffect(() => {
    if (!camera || !threeCameraRef.current) return;

    const threeCamera = threeCameraRef.current as {
      position: { set: (x: number, y: number, z: number) => void };
      rotation: { set: (x: number, y: number, z: number, order: string) => void };
      fov: number;
      updateProjectionMatrix: () => void;
    };

    threeCamera.position.set(
      camera.position.x,
      camera.position.y,
      camera.position.z
    );

    // Convert yaw/pitch to Euler rotation
    const degToRad = (deg: number) => (deg * Math.PI) / 180;
    threeCamera.rotation.set(
      degToRad(camera.rotation.pitch),
      degToRad(camera.rotation.yaw),
      0,
      "YXZ"
    );

    threeCamera.fov = camera.fov;
    threeCamera.updateProjectionMatrix();
  }, [camera, cameraId]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const renderer = rendererRef.current as {
        setSize?: (w: number, h: number) => void;
      } | null;
      if (renderer?.setSize) {
        renderer.setSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      {/* 3D Viewer Container */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      {/* Fallback when splat fails */}
      {loadError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-bg)",
          }}
        >
          {/* Static noise grid pattern */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.06,
              backgroundImage: `
                linear-gradient(rgba(0, 229, 255, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 229, 255, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px",
            }}
          />
          {/* Noise dots */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.03,
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "4px 4px",
              animation: "noise-shift 0.15s steps(3) infinite",
            }}
          />
          <div
            className="glow-cyan"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 18,
              letterSpacing: "0.3em",
              color: "var(--color-accent-cyan)",
              opacity: 0.7,
              zIndex: 1,
            }}
          >
            FEED UNAVAILABLE
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--color-text-dim)",
              marginTop: 12,
              zIndex: 1,
            }}
          >
            SPLAT ASSET NOT FOUND
          </div>
          <style>{`
            @keyframes noise-shift {
              0% { transform: translate(0, 0); }
              33% { transform: translate(-1px, 1px); }
              66% { transform: translate(1px, -1px); }
              100% { transform: translate(0, 0); }
            }
          `}</style>
        </div>
      )}

      {/* HUD Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {/* Classification banner */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            padding: "4px 0",
            background: "rgba(0, 0, 0, 0.6)",
            borderBottom: "1px solid rgba(0, 229, 255, 0.08)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: "0.4em",
              color: "var(--color-accent-cyan)",
              opacity: 0.4,
            }}
          >
            SURVEILLANCE FEED // EYES ONLY // {building?.name?.toUpperCase() ?? "UNKNOWN"}
          </span>
        </div>

        {/* Top-left: Camera ID, REC, Timestamp */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            className="glow-cyan"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "var(--color-accent-cyan)",
            }}
          >
            CAM-{cameraId}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ff2d2d",
                boxShadow: "0 0 6px rgba(255, 45, 45, 0.8), 0 0 12px rgba(255, 45, 45, 0.4)",
                animation: "rec-blink 1s step-start infinite",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#ff2d2d",
                textShadow: "0 0 8px rgba(255, 45, 45, 0.6)",
              }}
            >
              REC
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--color-text-dim)",
            }}
          >
            {timestamp}
          </div>
        </div>

        {/* Top-right: Position coordinates */}
        {camera && (
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 3,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--color-text-dim)",
            }}
          >
            <span>
              POS X:{" "}
              <span style={{ color: "var(--color-accent-green)" }}>
                {camera.position.x.toFixed(2)}
              </span>
            </span>
            <span>
              POS Y:{" "}
              <span style={{ color: "var(--color-accent-green)" }}>
                {camera.position.y.toFixed(2)}
              </span>
            </span>
            <span>
              POS Z:{" "}
              <span style={{ color: "var(--color-accent-green)" }}>
                {camera.position.z.toFixed(2)}
              </span>
            </span>
            <span style={{ marginTop: 4 }}>
              YAW:{" "}
              <span style={{ color: "var(--color-accent-cyan)" }}>
                {camera.rotation.yaw.toFixed(1)}
              </span>
              &deg;
            </span>
            <span>
              PITCH:{" "}
              <span style={{ color: "var(--color-accent-cyan)" }}>
                {camera.rotation.pitch.toFixed(1)}
              </span>
              &deg;
            </span>
            <span
              style={{
                marginTop: 6,
                fontSize: 8,
                letterSpacing: "0.2em",
                color: "var(--color-accent-cyan)",
                opacity: 0.4,
              }}
            >
              FOV: {camera.fov.toFixed(0)}&deg;
            </span>
          </div>
        )}

        {/* Corner brackets */}
        <span
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            width: 24,
            height: 24,
            borderTop: "2px solid rgba(0, 229, 255, 0.4)",
            borderLeft: "2px solid rgba(0, 229, 255, 0.4)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderTop: "2px solid rgba(0, 229, 255, 0.4)",
            borderRight: "2px solid rgba(0, 229, 255, 0.4)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            bottom: 80,
            left: 8,
            width: 24,
            height: 24,
            borderBottom: "2px solid rgba(0, 229, 255, 0.4)",
            borderLeft: "2px solid rgba(0, 229, 255, 0.4)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            bottom: 80,
            right: 8,
            width: 24,
            height: 24,
            borderBottom: "2px solid rgba(0, 229, 255, 0.4)",
            borderRight: "2px solid rgba(0, 229, 255, 0.4)",
          }}
        />
      </div>

      <style>{`
        @keyframes rec-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Simulation Prompt */}
      <SimulationPrompt
        onSubmit={onSimulationSubmit}
        isSimulating={isSimulating}
      />

      {/* FNAF Camera Switcher */}
      <FNAFSwitcher
        cameras={cameras}
        activeCameraId={cameraId}
        onSwitch={onSwitchCamera}
      />
    </div>
  );
}
