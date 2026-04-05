"use client";

import { useEffect, useRef, useState } from "react";
import type { Camera, Building } from "@/lib/types";
import FNAFSwitcher from "./FNAFSwitcher";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

// ----- TEMPORARY HARDCODED SCREENSHOTS -----
// Maps hardcoded camera IDs to static screenshot images.
// These replace the live 3D feed for demo purposes.
// To revert: delete this map and remove the `useStaticScreenshot` variable
// and the static image <img> block below (search for "STATIC_SCREENSHOT" comments).
// The live 3D CameraView will resume working as before.
const STATIC_SCREENSHOTS: Record<string, string> = {
  cam_h1: "/camera-screenshots/cam_h1.png",
  cam_h2: "/camera-screenshots/cam_h2.png",
  cam_h3: "/camera-screenshots/cam_h3.png",
  cam_h4: "/camera-screenshots/cam_h4.png",
};
// ----- END TEMPORARY HARDCODED SCREENSHOTS -----

interface CameraViewProps {
  cameraId: string;
  cameras: Camera[];
  building: Building | null;
  onSwitchCamera: (cameraId: string) => void;
  onClose: () => void;
}

export default function CameraView({
  cameraId,
  cameras,
  building,
  onSwitchCamera,
  onClose,
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

  // STATIC_SCREENSHOT: Use static image instead of live 3D feed for hardcoded cameras
  const useStaticScreenshot = cameraId in STATIC_SCREENSHOTS;

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
    if (!containerRef.current || sceneInitialized.current) return;

    sceneInitialized.current = true;
    let disposed = false;

    const initViewer = async () => {
      try {
        if (disposed || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 1.0));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(5, -5, 5);
        scene.add(dirLight);

        const threeCamera = new THREE.PerspectiveCamera(
          camera?.fov ?? 90,
          width / height,
          0.1,
          1000
        );
        threeCameraRef.current = threeCamera;

        // Match the building view's inverted Y coordinate system
        threeCamera.up.set(0, -1, 0);

        if (camera) {
          threeCamera.position.set(
            camera.position.x,
            camera.position.y,
            camera.position.z
          );
          // Use lookAt based on yaw direction instead of raw euler
          const yawRad = THREE.MathUtils.degToRad(camera.rotation.yaw);
          const lookTarget = new THREE.Vector3(
            camera.position.x + Math.sin(yawRad),
            camera.position.y,
            camera.position.z + Math.cos(yawRad)
          );
          threeCamera.lookAt(lookTarget);
        }

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Load OBJ interior mesh
        try {
          const mtlLoader = new MTLLoader();
          mtlLoader.setPath("/models/interior/");
          mtlLoader.load("4_4_2026.mtl", (materials) => {
            materials.preload();
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.load("/models/interior/4_4_2026.obj", (obj) => {
              // Match SceneView exactly: wrapper group handles transforms, obj just flips
              obj.rotation.x = Math.PI;

              const objWrapper = new THREE.Group();
              objWrapper.position.set(-1.65, -0.6, 16.9);
              const d = Math.PI / 180;
              objWrapper.rotation.set(0 * d, -267.5 * d, 0 * d);
              objWrapper.scale.set(0.25, 0.25, 0.25);
              objWrapper.add(obj);

              obj.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => (m.side = THREE.DoubleSide));
                  } else {
                    mesh.material.side = THREE.DoubleSide;
                  }
                }
              });

              scene.add(objWrapper);
              viewerRef.current = { dispose: () => {} };

              if (disposed) {
                renderer.dispose();
                if (container.contains(renderer.domElement)) {
                  container.removeChild(renderer.domElement);
                }
                return;
              }

              const animate = () => {
                if (disposed) return;
                frameIdRef.current = requestAnimationFrame(animate);
                renderer.render(scene, threeCamera);
              };
              animate();
            });
          });
        } catch {
          if (!disposed) {
            setLoadError(true);
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
              container.removeChild(renderer.domElement);
            }
          }
        }
      } catch {
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

    const yawRad = (camera.rotation.yaw * Math.PI) / 180;
    const lookTarget = {
      x: camera.position.x + Math.sin(yawRad),
      y: camera.position.y,
      z: camera.position.z + Math.cos(yawRad),
    };
    (threeCamera as unknown as THREE.PerspectiveCamera).lookAt(
      lookTarget.x, lookTarget.y, lookTarget.z
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
      {/* STATIC_SCREENSHOT: Show static image for hardcoded cameras, live 3D for others */}
      {useStaticScreenshot ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-bg)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={STATIC_SCREENSHOTS[cameraId]}
            alt={`Camera ${cameraId} feed`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      ) : (
        /* 3D Viewer Container — original live feed (preserved for non-hardcoded cameras) */
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
          }}
        />
      )}
      {/* END STATIC_SCREENSHOT */}

      {/* CRT Vignette */}
      <div className="crt-vignette" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }} />

      {/* Center Crosshair */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 2,
          opacity: 0.2,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <line x1="24" y1="0" x2="24" y2="18" stroke="#00e5ff" strokeWidth="0.5" />
          <line x1="24" y1="30" x2="24" y2="48" stroke="#00e5ff" strokeWidth="0.5" />
          <line x1="0" y1="24" x2="18" y2="24" stroke="#00e5ff" strokeWidth="0.5" />
          <line x1="30" y1="24" x2="48" y2="24" stroke="#00e5ff" strokeWidth="0.5" />
          <circle cx="24" cy="24" r="3" stroke="#00e5ff" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

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
            className="noise-shift"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.03,
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "4px 4px",
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
              className="rec-blink"
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ff2d2d",
                boxShadow: "0 0 6px rgba(255, 45, 45, 0.8), 0 0 12px rgba(255, 45, 45, 0.4)",
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

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 30,
          padding: "7px 16px",
          background: "rgba(10,10,10,0.8)",
          border: "1px solid rgba(0,229,255,0.2)",
          borderRadius: 6,
          color: "rgba(0,229,255,0.7)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.15em",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        ← WORLD VIEW
      </button>

      {/* FNAF Camera Switcher */}
      <FNAFSwitcher
        cameras={cameras}
        activeCameraId={cameraId}
        onSwitch={onSwitchCamera}
      />
    </div>
  );
}
