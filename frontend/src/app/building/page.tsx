"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import BuildingView from "../../components/BuildingView";
import LayersSidebar from "../../components/LayersSidebar";
import type { Layer } from "../../components/LayersSidebar";
import PropertiesPanel from "../../components/PropertiesPanel";
import type { SceneObjects, CameraPlacement } from "../../components/SceneView";
import type { Mesh, Object3D } from "three";

const SceneView = dynamic(() => import("../../components/SceneView"), {
  ssr: false,
});

const DEFAULT_LAYERS: Layer[] = [
  { id: "outdoor", name: "Outdoor", type: "splat", visible: true },
  { id: "indoor", name: "Indoor", type: "obj", visible: true },
];

export default function BuildingPage() {
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; z: number }>>({
    outdoor: { x: 0, y: 0, z: 0 },
    indoor: { x: -1.65, y: -0.6, z: 16.9 },
  });
  const [rotations, setRotations] = useState<Record<string, { x: number; y: number; z: number }>>({
    outdoor: { x: 0, y: 0, z: 0 },
    indoor: { x: 0, y: -267.5, z: 0 },
  });
  const [scales, setScales] = useState<Record<string, { x: number; y: number; z: number }>>({
    outdoor: { x: 1, y: 1, z: 1 },
    indoor: { x: 0.25, y: 0.25, z: 0.25 },
  });
  const sceneObjectsRef = useRef<SceneObjects>({ splatGroup: null, objGroup: null });
  // Map layer id -> Three.js mesh for camera markers
  const cameraMarkersRef = useRef<Record<string, Mesh>>({});
  const cameraCountRef = useRef(0);

  const handleObjectsReady = useCallback((objects: SceneObjects) => {
    sceneObjectsRef.current = objects;
    console.log("[BuildingPage] Objects ready:", {
      splat: !!objects.splatGroup,
      obj: !!objects.objGroup,
    });
  }, []);

  const handleCameraPlaced = useCallback((placement: CameraPlacement) => {
    cameraCountRef.current += 1;
    const id = `cam_${cameraCountRef.current}`;
    const pos = placement.position;

    // Store the mesh ref
    cameraMarkersRef.current[id] = placement.mesh;

    // Add layer
    setLayers((prev) => [
      ...prev,
      { id, name: `Camera ${cameraCountRef.current}`, type: "camera", visible: true },
    ]);

    // Add position and scale
    setPositions((prev) => ({
      ...prev,
      [id]: { x: pos.x, y: pos.y, z: pos.z },
    }));
    setRotations((prev) => ({
      ...prev,
      [id]: { x: 0, y: 0, z: 0 },
    }));
    setScales((prev) => ({
      ...prev,
      [id]: { x: 1, y: 1, z: 1 },
    }));

    // Select the new camera
    setSelectedLayerId(id);
  }, []);

  const handleToggleVisibility = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const newVisible = !l.visible;
        // For camera markers, directly set Three.js visibility
        if (id !== "outdoor" && id !== "indoor") {
          const marker = cameraMarkersRef.current[id];
          if (marker) marker.visible = newVisible;
        }
        return { ...l, visible: newVisible };
      })
    );
  }, []);

  const handleSelectLayer = useCallback((id: string) => {
    setSelectedLayerId(id);
  }, []);

  const handlePositionChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      if (!selectedLayerId) return;
      setPositions((prev) => ({
        ...prev,
        [selectedLayerId]: { ...prev[selectedLayerId], [axis]: value },
      }));
      // Get the right Three.js object
      let obj: Object3D | null = null;
      if (selectedLayerId === "outdoor") obj = sceneObjectsRef.current.splatGroup;
      else if (selectedLayerId === "indoor") obj = sceneObjectsRef.current.objGroup;
      else obj = cameraMarkersRef.current[selectedLayerId] || null;
      if (obj) {
        obj.position.set(
          axis === "x" ? value : obj.position.x,
          axis === "y" ? value : obj.position.y,
          axis === "z" ? value : obj.position.z,
        );
      }
    },
    [selectedLayerId],
  );

  const handleRotationChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      if (!selectedLayerId) return;
      setRotations((prev) => ({
        ...prev,
        [selectedLayerId]: { ...prev[selectedLayerId], [axis]: value },
      }));
      let obj: Object3D | null = null;
      if (selectedLayerId === "outdoor") obj = sceneObjectsRef.current.splatGroup;
      else if (selectedLayerId === "indoor") obj = sceneObjectsRef.current.objGroup;
      else obj = cameraMarkersRef.current[selectedLayerId] || null;
      if (obj) {
        const deg2rad = Math.PI / 180;
        obj.rotation.set(
          (axis === "x" ? value : rotations[selectedLayerId]?.x ?? 0) * deg2rad,
          (axis === "y" ? value : rotations[selectedLayerId]?.y ?? 0) * deg2rad,
          (axis === "z" ? value : rotations[selectedLayerId]?.z ?? 0) * deg2rad,
        );
      }
    },
    [selectedLayerId, rotations],
  );

  const handleScaleChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      if (!selectedLayerId) return;
      setScales((prev) => ({
        ...prev,
        [selectedLayerId]: { ...prev[selectedLayerId], [axis]: value },
      }));
      let obj: Object3D | null = null;
      if (selectedLayerId === "outdoor") obj = sceneObjectsRef.current.splatGroup;
      else if (selectedLayerId === "indoor") obj = sceneObjectsRef.current.objGroup;
      else obj = cameraMarkersRef.current[selectedLayerId] || null;
      if (obj) {
        obj.scale.set(
          axis === "x" ? value : obj.scale.x,
          axis === "y" ? value : obj.scale.y,
          axis === "z" ? value : obj.scale.z,
        );
      }
    },
    [selectedLayerId],
  );

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const selectedPosition = selectedLayerId
    ? positions[selectedLayerId] ?? { x: 0, y: 0, z: 0 }
    : { x: 0, y: 0, z: 0 };
  const selectedRotation = selectedLayerId
    ? rotations[selectedLayerId] ?? { x: 0, y: 0, z: 0 }
    : { x: 0, y: 0, z: 0 };
  const selectedScale = selectedLayerId
    ? scales[selectedLayerId] ?? { x: 1, y: 1, z: 1 }
    : { x: 1, y: 1, z: 1 };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="building-page"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* 3D scene fills entire viewport */}
        <SceneView
          splatPath="/splats/dsai.spz"
          objPath="/models/interior/4_4_2026.obj"
          mtlPath="/models/interior/4_4_2026.mtl"
          placementMode={placementMode}
          splatVisible={layers.find((l) => l.id === "outdoor")?.visible ?? true}
          objVisible={layers.find((l) => l.id === "indoor")?.visible ?? true}
          objPosition={{ x: -1.65, y: -0.6, z: 16.9 }}
          objRotation={{ x: 0, y: -267.5, z: 0 }}
          objScale={{ x: 0.25, y: 0.25, z: 0.25 }}
          onObjectsReady={handleObjectsReady}
          onCameraPlaced={handleCameraPlaced}
        />

        {/* Left sidebar: Layers */}
        <LayersSidebar
          layers={layers}
          selectedLayerId={selectedLayerId}
          onToggleVisibility={handleToggleVisibility}
          onSelectLayer={handleSelectLayer}
        />

        {/* Placement mode toggle */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
          }}
        >
          <button
            onClick={() => setPlacementMode((p) => !p)}
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: placementMode ? "#0a0a0a" : "var(--color-accent-cyan)",
              background: placementMode
                ? "var(--color-accent-cyan)"
                : "rgba(10, 10, 10, 0.85)",
              backdropFilter: "blur(8px)",
              border: placementMode
                ? "1px solid var(--color-accent-cyan)"
                : "1px solid rgba(0, 229, 255, 0.3)",
              borderRadius: "4px",
              padding: "8px 20px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {placementMode ? "PLACING CAMERAS — CLICK WALLS" : "PLACE CAMERA (P)"}
          </button>
        </div>

        {/* Right panel: Properties (top) */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: "260px",
            zIndex: 20,
            backgroundColor: "rgba(10, 10, 10, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(0, 229, 255, 0.15)",
            borderRadius: "6px",
            padding: "16px",
          }}
        >
          <PropertiesPanel
            layer={selectedLayer}
            position={selectedPosition}
            rotation={selectedRotation}
            scale={selectedScale}
            onPositionChange={handlePositionChange}
            onRotationChange={handleRotationChange}
            onScaleChange={handleScaleChange}
          />
        </div>

        {/* Bottom-right: BuildingView panel (budget, deploy, floor plan) */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            width: "420px",
            maxHeight: "calc(100vh - 320px)",
            overflowY: "auto",
            zIndex: 10,
            pointerEvents: "auto",
          }}
        >
          <BuildingView />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
