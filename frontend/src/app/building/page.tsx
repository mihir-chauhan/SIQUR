"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import BuildingView from "../../components/BuildingView";
import LayersSidebar from "../../components/LayersSidebar";
import type { Layer } from "../../components/LayersSidebar";
import PropertiesPanel from "../../components/PropertiesPanel";
import type { SceneObjects } from "../../components/SceneView";

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
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; z: number }>>({
    outdoor: { x: 0, y: 0, z: 0 },
    indoor: { x: 0, y: 0, z: 0 },
  });
  const sceneObjectsRef = useRef<SceneObjects>({ splatGroup: null, objGroup: null });

  const handleObjectsReady = useCallback((objects: SceneObjects) => {
    // Store the same mutable object — not a copy
    sceneObjectsRef.current = objects;
    console.log("[BuildingPage] Objects ready:", {
      splat: !!objects.splatGroup,
      obj: !!objects.objGroup,
    });
  }, []);

  const handleToggleVisibility = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const newVisible = !l.visible;
        // Update Three.js object visibility
        const obj =
          id === "outdoor"
            ? sceneObjectsRef.current.splatGroup
            : sceneObjectsRef.current.objGroup;
        if (obj) obj.visible = newVisible;
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
      // Update Three.js object position in real time
      const obj =
        selectedLayerId === "outdoor"
          ? sceneObjectsRef.current.splatGroup
          : sceneObjectsRef.current.objGroup;
      if (obj) {
        obj.position.set(
          axis === "x" ? value : obj.position.x,
          axis === "y" ? value : obj.position.y,
          axis === "z" ? value : obj.position.z
        );
      }
    },
    [selectedLayerId]
  );

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const selectedPosition = selectedLayerId
    ? positions[selectedLayerId]
    : { x: 0, y: 0, z: 0 };

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
          splatPath="/splats/elliott.spz"
          objPath="/models/interior/4_4_2026.obj"
          mtlPath="/models/interior/4_4_2026.mtl"
          onObjectsReady={handleObjectsReady}
        />

        {/* Left sidebar: Layers */}
        <LayersSidebar
          layers={layers}
          selectedLayerId={selectedLayerId}
          onToggleVisibility={handleToggleVisibility}
          onSelectLayer={handleSelectLayer}
        />

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
            onPositionChange={handlePositionChange}
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
