"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import BuildingView from "../../components/BuildingView";
import LayersSidebar from "../../components/LayersSidebar";
import type { Layer } from "../../components/LayersSidebar";
import PropertiesPanel from "../../components/PropertiesPanel";
import type { SceneObjects, CameraPlacement } from "../../components/SceneView";
import { getPlacedCameras, setPlacedCameras } from "../../lib/session";
import type { Camera } from "../../lib/types";
import type { Mesh, Object3D } from "three";

const SceneView = dynamic(() => import("../../components/SceneView"), {
  ssr: false,
});

const DEFAULT_LAYERS: Layer[] = [
  { id: "outdoor", name: "Outdoor", type: "splat", visible: true },
  { id: "indoor", name: "Indoor", type: "obj", visible: true },
];

export default function BuildingPage() {
  const router = useRouter();
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

  // Clear stale cameras from localStorage on mount
  useEffect(() => {
    setPlacedCameras([]);
  }, []);
  // Map layer id -> Three.js mesh for camera markers
  const cameraMarkersRef = useRef<Record<string, Mesh>>({});
  const [coneVisible, setConeVisible] = useState<Record<string, boolean>>({});
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

    // Build Camera object matching the schema
    const camera: Camera = {
      id,
      building_id: "dsai",
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { yaw: placement.yaw, pitch: placement.pitch },
      fov: 90,
      coverage_radius: 10,
      placement_score: 1.0,
    };

    // Sync to localStorage so /camera/[id] can read it
    const existing = getPlacedCameras();
    setPlacedCameras([...existing, camera]);

    // Store the mesh ref for visibility/transform
    cameraMarkersRef.current[id] = placement.mesh;

    // Add layer
    setLayers((prev) => [
      ...prev,
      { id, name: `Camera ${cameraCountRef.current}`, type: "camera", visible: true },
    ]);

    // Add position, rotation, scale
    setPositions((prev) => ({
      ...prev,
      [id]: { x: pos.x, y: pos.y, z: pos.z },
    }));
    setRotations((prev) => ({
      ...prev,
      [id]: { x: 0, y: placement.yaw, z: 0 },
    }));
    setScales((prev) => ({
      ...prev,
      [id]: { x: 1, y: 1, z: 1 },
    }));
    setConeVisible((prev) => ({ ...prev, [id]: true }));

    setSelectedLayerId(id);
  }, []);

  const handleToggleCone = useCallback((id: string, visible: boolean) => {
    setConeVisible((prev) => ({ ...prev, [id]: visible }));
    // Toggle the cone mesh (second child of the marker group)
    const markerGroup = cameraMarkersRef.current[id];
    if (markerGroup && markerGroup.children) {
      const cone = markerGroup.children[1];
      if (cone) cone.visible = visible;
    }
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

  const handleDeleteLayer = useCallback((id: string) => {
    // Remove the Three.js object from scene
    const marker = cameraMarkersRef.current[id];
    if (marker) {
      marker.parent?.remove(marker);
      delete cameraMarkersRef.current[id];
    }
    // Remove from layers
    setLayers((prev) => prev.filter((l) => l.id !== id));
    // Clear selection if deleted
    setSelectedLayerId((prev) => (prev === id ? null : prev));
    // Remove from localStorage
    const placed = getPlacedCameras();
    setPlacedCameras(placed.filter((c) => c.id !== id));
    // Clean up position/rotation/scale state
    setPositions((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setRotations((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setScales((prev) => { const n = { ...prev }; delete n[id]; return n; });
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
          onCameraClicked={(camId) => router.push(`/camera/${camId}`)}
        />

        {/* Left sidebar: Layers */}
        <LayersSidebar
          layers={layers}
          selectedLayerId={selectedLayerId}
          onToggleVisibility={handleToggleVisibility}
          onSelectLayer={handleSelectLayer}
          onDeleteLayer={handleDeleteLayer}
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
            onClick={(e) => { e.stopPropagation(); setPlacementMode((p) => !p); }}
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

        {/* Right panel: full-height, properties + floor plan + budget */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "280px",
            zIndex: 20,
            backgroundColor: "rgba(10, 10, 10, 0.9)",
            backdropFilter: "blur(12px)",
            borderLeft: "1px solid rgba(0, 229, 255, 0.1)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Properties section */}
          <div style={{ padding: "16px", borderBottom: "1px solid rgba(0, 229, 255, 0.08)" }}>
            <PropertiesPanel
              layer={selectedLayer}
              position={selectedPosition}
              rotation={selectedRotation}
              scale={selectedScale}
              showCone={selectedLayerId ? coneVisible[selectedLayerId] ?? true : false}
              onPositionChange={handlePositionChange}
              onRotationChange={handleRotationChange}
              onScaleChange={handleScaleChange}
              onToggleCone={selectedLayerId ? (v) => handleToggleCone(selectedLayerId, v) : undefined}
            />
          </div>

          {/* Floor plan + budget */}
          <div style={{ flex: 1, pointerEvents: "auto" }}>
            <BuildingView />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
