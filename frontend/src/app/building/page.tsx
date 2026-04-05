"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import BuildingView from "../../components/BuildingView";
import ModeSidebar from "../../components/ModeSidebar";
import LayersSidebar from "../../components/LayersSidebar";
import type { Layer } from "../../components/LayersSidebar";
import PropertiesPanel from "../../components/PropertiesPanel";
import type { SceneObjects, CameraPlacement, SceneHandle } from "../../components/SceneView";
import { getPlacedCameras, setPlacedCameras } from "../../lib/session";
import type { Camera } from "../../lib/types";
import type { Mesh, Object3D } from "three";

const SceneView = dynamic(() => import("../../components/SceneView"), {
  ssr: false,
});

const HARDCODED_CAMERAS: Array<{ id: string; pos: { x: number; y: number; z: number }; yaw: number }> = [
  { id: "cam_h1", pos: { x: -5.54, y: -1.00, z: 15.87 }, yaw: 270.97 },
  { id: "cam_h2", pos: { x: -3.93, y: -0.89, z: 13.34 }, yaw: 181.08 },
  { id: "cam_h3", pos: { x:  0.05, y: -0.86, z: 15.19 }, yaw: 181.01 },
  { id: "cam_h4", pos: { x:  4.71, y: -1.06, z: 19.20 }, yaw:  17.93 },
];

const DEFAULT_LAYERS: Layer[] = [
  { id: "outdoor", name: "Outdoor", type: "splat", visible: true },
  { id: "indoor", name: "Indoor", type: "obj", visible: true },
  { id: "cam_h1", name: "Camera 1", type: "camera", visible: true },
  { id: "cam_h2", name: "Camera 2", type: "camera", visible: true },
  { id: "cam_h3", name: "Camera 3", type: "camera", visible: true },
  { id: "cam_h4", name: "Camera 4", type: "camera", visible: true },
];

/* ── Surveillance Configuration Screen ── */
const PRIORITY_ZONE_OPTIONS = [
  "Main Entrances",
  "Emergency Exits",
  "Hallways",
  "Server/Data Rooms",
  "Stairwells",
] as const;

function ConfigScreen({
  onSubmit,
}: {
  onSubmit: (config: {
    cameraCount: number;
    coverageTarget: number;
    priorityZones: string[];
    overlapReq: number;
  }) => void;
}) {
  const [cameraCount, setCameraCount] = useState(4);
  const [coverageTarget, setCoverageTarget] = useState(85);
  const [priorityZones, setPriorityZones] = useState<string[]>([
    "Main Entrances",
    "Hallways",
  ]);
  const [overlapReq, setOverlapReq] = useState(15);

  const toggleZone = (zone: string) => {
    setPriorityZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    );
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-space-mono, monospace)",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.3em",
    color: "rgba(0, 229, 255, 0.6)",
    textTransform: "uppercase",
    marginBottom: "8px",
    display: "block",
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: "28px",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "radial-gradient(ellipse at 50% 30%, #0f1923 0%, #0a0e14 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-space-mono, monospace)",
      }}
    >
      {/* Scan lines overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 229, 255, 0.015) 2px, rgba(0, 229, 255, 0.015) 4px)",
          pointerEvents: "none",
        }}
      />

      <style>{`@keyframes configFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
      <div style={{ animation: "configFadeIn 0.6s ease-out" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "48px 40px 36px",
          border: "1px solid rgba(0, 229, 255, 0.15)",
          borderRadius: "2px",
          background: "rgba(10, 14, 20, 0.95)",
          boxShadow:
            "0 0 60px rgba(0, 229, 255, 0.06), inset 0 0 60px rgba(0, 229, 255, 0.02)",
        }}
      >
        {/* Corner accents */}
        {[
          { top: -1, left: -1 },
          { top: -1, right: -1 },
          { bottom: -1, left: -1 },
          { bottom: -1, right: -1 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: "20px",
              height: "20px",
              borderColor: "rgba(0, 229, 255, 0.4)",
              borderStyle: "solid",
              borderWidth: 0,
              ...(pos.top !== undefined && { top: pos.top, borderTopWidth: "1px" }),
              ...(pos.bottom !== undefined && { bottom: pos.bottom, borderBottomWidth: "1px" }),
              ...(pos.left !== undefined && { left: pos.left, borderLeftWidth: "1px" }),
              ...(pos.right !== undefined && { right: pos.right, borderRightWidth: "1px" }),
            } as React.CSSProperties}
          />
        ))}

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <h1
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "#00e5ff",
              margin: 0,
              textTransform: "uppercase",
              textShadow: "0 0 20px rgba(0, 229, 255, 0.3)",
            }}
          >
            SURVEILLANCE CONFIGURATION
          </h1>
          <p
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: "10px",
              letterSpacing: "0.25em",
              color: "rgba(255, 255, 255, 0.5)",
              margin: "8px 0 0",
              textTransform: "uppercase",
            }}
          >
            CONFIGURE PLACEMENT PARAMETERS
          </p>
        </div>

        {/* Camera Count */}
        <div style={sectionStyle}>
          <label style={labelStyle}>CAMERA UNITS</label>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input
              type="range"
              min={1}
              max={12}
              value={cameraCount}
              onChange={(e) => setCameraCount(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: "#00e5ff",
                height: "2px",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-space-mono, monospace)",
                fontSize: "20px",
                fontWeight: 700,
                color: "#00e5ff",
                minWidth: "32px",
                textAlign: "right",
              }}
            >
              {cameraCount}
            </span>
          </div>
        </div>

        {/* Coverage Target */}
        <div style={sectionStyle}>
          <label style={labelStyle}>COVERAGE TARGET</label>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input
              type="range"
              min={50}
              max={100}
              value={coverageTarget}
              onChange={(e) => setCoverageTarget(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: "#00e5ff",
                height: "2px",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-space-mono, monospace)",
                fontSize: "20px",
                fontWeight: 700,
                color: "#00e5ff",
                minWidth: "48px",
                textAlign: "right",
              }}
            >
              {coverageTarget}%
            </span>
          </div>
        </div>

        {/* Priority Zones */}
        <div style={sectionStyle}>
          <label style={labelStyle}>PRIORITY ZONES</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {PRIORITY_ZONE_OPTIONS.map((zone) => {
              const active = priorityZones.includes(zone);
              return (
                <button
                  key={zone}
                  onClick={() => toggleZone(zone)}
                  style={{
                    fontFamily: "var(--font-space-mono, monospace)",
                    fontSize: "10px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    padding: "8px 14px",
                    border: active
                      ? "1px solid rgba(0, 229, 255, 0.6)"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "2px",
                    background: active
                      ? "rgba(0, 229, 255, 0.1)"
                      : "rgba(255, 255, 255, 0.03)",
                    color: active ? "#00e5ff" : "rgba(255, 255, 255, 0.4)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {active ? "\u25A0 " : "\u25A1 "}
                  {zone}
                </button>
              );
            })}
          </div>
        </div>

        {/* Overlap Requirement */}
        <div style={sectionStyle}>
          <label style={labelStyle}>CAMERA OVERLAP</label>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input
              type="range"
              min={0}
              max={40}
              value={overlapReq}
              onChange={(e) => setOverlapReq(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: "#00e5ff",
                height: "2px",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-space-mono, monospace)",
                fontSize: "20px",
                fontWeight: 700,
                color: "#00e5ff",
                minWidth: "48px",
                textAlign: "right",
              }}
            >
              {overlapReq}%
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={() =>
            onSubmit({
              cameraCount,
              coverageTarget,
              priorityZones,
              overlapReq,
            })
          }
          style={{
            width: "100%",
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            padding: "16px 0",
            marginTop: "8px",
            border: "1px solid rgba(0, 229, 255, 0.5)",
            borderRadius: "2px",
            background: "rgba(0, 229, 255, 0.08)",
            color: "#00e5ff",
            cursor: "pointer",
            transition: "all 0.2s ease",
            textShadow: "0 0 12px rgba(0, 229, 255, 0.4)",
            boxShadow: "0 0 30px rgba(0, 229, 255, 0.08)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0, 229, 255, 0.15)";
            e.currentTarget.style.boxShadow = "0 0 40px rgba(0, 229, 255, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0, 229, 255, 0.08)";
            e.currentTarget.style.boxShadow = "0 0 30px rgba(0, 229, 255, 0.08)";
          }}
        >
          &#9654; INITIALIZE PLACEMENT
        </button>
      </div>
      </div>

      {/* Custom scrollbar styling */}
      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0, 229, 255, 0.2); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0, 229, 255, 0.4); }
      `}</style>
    </div>
  );
}

export default function BuildingPage() {
  const router = useRouter();
  const [configDone, setConfigDone] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [modeTransition, setModeTransition] = useState(false);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; z: number }>>({
    outdoor: { x: 0, y: 0, z: 0 },
    indoor: { x: -1.65, y: -0.6, z: 16.9 },
    cam_h1: { x: -5.54, y: -1.00, z: 15.87 },
    cam_h2: { x: -3.93, y: -0.89, z: 13.34 },
    cam_h3: { x:  0.05, y: -0.86, z: 15.19 },
    cam_h4: { x:  4.71, y: -1.06, z: 19.20 },
  });
  const [rotations, setRotations] = useState<Record<string, { x: number; y: number; z: number }>>({
    outdoor: { x: 0, y: 0, z: 0 },
    indoor: { x: 0, y: -267.5, z: 0 },
    cam_h1: { x: 0, y: 270.97, z: 0 },
    cam_h2: { x: 0, y: 181.08, z: 0 },
    cam_h3: { x: 0, y: 181.01, z: 0 },
    cam_h4: { x: 0, y:  17.93, z: 0 },
  });
  const [scales, setScales] = useState<Record<string, { x: number; y: number; z: number }>>({
    outdoor: { x: 1, y: 1, z: 1 },
    indoor: { x: 0.25, y: 0.25, z: 0.25 },
    cam_h1: { x: 1, y: 1, z: 1 },
    cam_h2: { x: 1, y: 1, z: 1 },
    cam_h3: { x: 1, y: 1, z: 1 },
    cam_h4: { x: 1, y: 1, z: 1 },
  });
  const sceneObjectsRef = useRef<SceneObjects>({ splatGroup: null, objGroup: null });
  const sceneHandleRef = useRef<SceneHandle | null>(null);

  // Seed hardcoded cameras into localStorage on mount
  useEffect(() => {
    const hardcodedCameraObjects: Camera[] = HARDCODED_CAMERAS.map((hc, i) => ({
      id: hc.id,
      building_id: "dsai",
      position: hc.pos,
      rotation: { yaw: hc.yaw, pitch: -20 },
      fov: 90,
      coverage_radius: 10,
      placement_score: 1.0,
    }));
    setPlacedCameras(hardcodedCameraObjects);
  }, []);
  // Map layer id -> Three.js mesh for camera markers
  const cameraMarkersRef = useRef<Record<string, Mesh>>({});
  const [coneVisible, setConeVisible] = useState<Record<string, boolean>>({
    cam_h1: true,
    cam_h2: true,
    cam_h3: true,
    cam_h4: true,
  });
  const [cameraYaws, setCameraYaws] = useState<Record<string, number>>({
    cam_h1: 270.97,
    cam_h2: 181.08,
    cam_h3: 181.01,
    cam_h4:  17.93,
  });
  const cameraCountRef = useRef(4);

  const handleCaptureCam = useCallback(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    const data = handle.captureCamera();
    if (!data) return;

    cameraCountRef.current += 1;
    const id = `cam_${cameraCountRef.current}`;
    const pos = data.position;

    // Spawn the visual marker in the 3D scene
    const markerGroup = handle.spawnMarker(id, pos, data.yaw);
    if (markerGroup) {
      cameraMarkersRef.current[id] = markerGroup as unknown as Mesh;
    }

    setLayers((prev) => [
      ...prev,
      { id, name: `Camera ${cameraCountRef.current}`, type: "camera", visible: true },
    ]);
    setPositions((prev) => ({ ...prev, [id]: pos }));
    setRotations((prev) => ({ ...prev, [id]: { x: 0, y: data.yaw, z: 0 } }));
    setScales((prev) => ({ ...prev, [id]: { x: 1, y: 1, z: 1 } }));
    setConeVisible((prev) => ({ ...prev, [id]: true }));
    setCameraYaws((prev) => ({ ...prev, [id]: data.yaw }));

    // Persist to localStorage
    const existing = getPlacedCameras();
    existing.push({
      id,
      building_id: "dsai",
      position: pos,
      rotation: { yaw: data.yaw, pitch: -20 },
      fov: 90,
      coverage_radius: 10,
      placement_score: 1.0,
    });
    setPlacedCameras(existing);
  }, []);

  const handleObjectsReady = useCallback((objects: SceneObjects) => {
    sceneObjectsRef.current = objects;
    // Grab marker refs for hardcoded cameras after scene init
    const handle = sceneHandleRef.current;
    if (handle) {
      for (const hc of HARDCODED_CAMERAS) {
        const marker = handle.getMarker(hc.id);
        if (marker) {
          cameraMarkersRef.current[hc.id] = marker as unknown as Mesh;
        }
      }
    }
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
    setCameraYaws((prev) => ({ ...prev, [id]: placement.yaw }));

    setSelectedLayerId(id);
  }, []);

  const handleToggleCone = useCallback((id: string, visible: boolean) => {
    setConeVisible((prev) => ({ ...prev, [id]: visible }));
    // Try cached ref first, fall back to sceneHandle lookup
    let markerGroup = cameraMarkersRef.current[id];
    if (!markerGroup && sceneHandleRef.current) {
      const found = sceneHandleRef.current.getMarker(id);
      if (found) {
        cameraMarkersRef.current[id] = found as unknown as Mesh;
        markerGroup = found as unknown as Mesh;
      }
    }
    if (markerGroup && markerGroup.children) {
      // children: [0] = orb sphere, [1] = cone, [2] = aimline
      for (const child of markerGroup.children) {
        if ((child as { name?: string }).name === "cone" || (child as { name?: string }).name === "aimline") {
          child.visible = visible;
        }
      }
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

  const handleSave = useCallback(() => {
    if (!selectedLayerId) return;
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (layer?.type !== "camera") return;
    const pos = positions[selectedLayerId];
    const rot = rotations[selectedLayerId];
    if (!pos || !rot) return;
    const placed = getPlacedCameras();
    const cam = placed.find((c) => c.id === selectedLayerId);
    if (cam) {
      cam.position = pos;
      cam.rotation = { yaw: rot.y, pitch: -20 };
      setPlacedCameras(placed);
    } else {
      placed.push({
        id: selectedLayerId,
        building_id: "dsai",
        position: pos,
        rotation: { yaw: rot.y, pitch: -20 },
        fov: 90,
        coverage_radius: 10,
        placement_score: 1.0,
      });
      setPlacedCameras(placed);
    }
  }, [selectedLayerId, positions, rotations, layers]);

  const handleDeleteLayer = useCallback((id: string) => {
    // Don't allow deleting hardcoded cameras or base layers
    const protectedIds = new Set(["outdoor", "indoor", ...HARDCODED_CAMERAS.map(c => c.id)]);
    if (protectedIds.has(id)) return;
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

  if (!configDone) {
    return (
      <ConfigScreen
        onSubmit={() => {
          setConfigDone(true);
        }}
      />
    );
  }

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
          hardcodedCameras={HARDCODED_CAMERAS}
          sceneRef={sceneHandleRef}
          onObjectsReady={handleObjectsReady}
          onCameraPlaced={handleCameraPlaced}
          onCameraClicked={(camId) => router.push(`/camera/${camId}`)}
          onSplatLoaded={() => {
            setSceneReady(true);
            // Grab hardcoded camera marker refs now that everything is spawned
            const handle = sceneHandleRef.current;
            if (handle) {
              for (const hc of HARDCODED_CAMERAS) {
                const marker = handle.getMarker(hc.id);
                if (marker) {
                  cameraMarkersRef.current[hc.id] = marker as unknown as Mesh;
                }
              }
            }
          }}
        />

        {/* Building name header */}
        <div style={{
          position: "absolute",
          top: 56,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          textAlign: "center",
          pointerEvents: "none",
        }}>
          <span style={{
            color: "#00e5ff",
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: "12px",
            letterSpacing: "0.3em",
          }}>
            HALL OF DATA SCIENCE AND AI
          </span>
          <br />
          <span style={{
            color: "#555",
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: "10px",
            letterSpacing: "0.2em",
          }}>
            INTERIOR SCAN // 3D RECONSTRUCTION
          </span>
        </div>

        {/* Mode switcher (far left) */}
        <ModeSidebar onTransitionStart={() => setModeTransition(true)} />

        {/* Transition overlay — black screen when switching to Watchman */}
        {modeTransition && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 48,
              right: 0,
              bottom: 0,
              zIndex: 100,
              background: "#000",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              animation: "fadeIn 0.3s ease forwards",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "2px solid rgba(0, 229, 255, 0.15)",
                borderTopColor: "rgba(0, 229, 255, 0.8)",
                animation: "spin 1s linear infinite",
                marginBottom: 20,
              }}
            />
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
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
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}

        {/* Left sidebar: Layers */}
        <LayersSidebar
          layers={sceneReady ? layers : layers.filter((l) => l.type !== "camera")}
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
              yaw={selectedLayerId ? cameraYaws[selectedLayerId] : undefined}
              onPositionChange={handlePositionChange}
              onRotationChange={handleRotationChange}
              onScaleChange={handleScaleChange}
              onToggleCone={selectedLayerId ? (v) => handleToggleCone(selectedLayerId, v) : undefined}
              onSave={selectedLayerId && layers.find((l) => l.id === selectedLayerId)?.type === "camera" ? handleSave : undefined}
            />
          </div>

          {/* Deployment Analytics — hidden until splats finish loading */}
          <div style={{ display: sceneReady ? "block" : "none", padding: "16px", borderBottom: "1px solid rgba(0, 229, 255, 0.08)" }}>
            <div style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "rgba(0, 229, 255, 0.5)",
              marginBottom: "12px",
            }}>
              DEPLOYMENT ANALYTICS
            </div>

            {/* Sector Coverage */}
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(0, 229, 255, 0.4)", textTransform: "uppercase", marginBottom: "4px" }}>
                Sector Coverage
              </div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "20px", fontWeight: 700, color: "#00e5ff", lineHeight: 1 }}>
                87.4%
              </div>
              <div style={{ marginTop: "4px", height: "2px", background: "rgba(0, 229, 255, 0.1)", borderRadius: "1px", overflow: "hidden" }}>
                <div style={{ width: "87.4%", height: "100%", background: "#00e5ff", borderRadius: "1px" }} />
              </div>
            </div>

            {/* Cameras Active */}
            <div style={{ padding: "8px 0", borderTop: "1px solid rgba(0, 229, 255, 0.08)" }}>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(0, 229, 255, 0.4)", textTransform: "uppercase", marginBottom: "4px" }}>
                Cameras Active
              </div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>
                4 / 4
              </div>
            </div>

            {/* Blind Spots */}
            <div style={{ padding: "8px 0", borderTop: "1px solid rgba(0, 229, 255, 0.08)" }}>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(0, 229, 255, 0.4)", textTransform: "uppercase", marginBottom: "4px" }}>
                Blind Spots
              </div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "14px", fontWeight: 600, color: "#f59e0b" }}>
                2 detected
              </div>
            </div>

            {/* Dead Zone Ratio */}
            <div style={{ padding: "8px 0", borderTop: "1px solid rgba(0, 229, 255, 0.08)" }}>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(0, 229, 255, 0.4)", textTransform: "uppercase", marginBottom: "4px" }}>
                Dead Zone Ratio
              </div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "14px", fontWeight: 600, color: "#10b981" }}>
                3.1%
              </div>
            </div>

            {/* Priority Zones */}
            <div style={{ padding: "8px 0", borderTop: "1px solid rgba(0, 229, 255, 0.08)" }}>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(0, 229, 255, 0.4)", textTransform: "uppercase", marginBottom: "4px" }}>
                Priority Zones
              </div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>
                3 / 5 secured
              </div>
            </div>

            {/* Overlap Index */}
            <div style={{ padding: "8px 0", borderTop: "1px solid rgba(0, 229, 255, 0.08)" }}>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(0, 229, 255, 0.4)", textTransform: "uppercase", marginBottom: "4px" }}>
                Overlap Index
              </div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>
                18.2%
              </div>
            </div>
          </div>

          {/* Floor plan + budget — hidden until splats finish loading */}
          <div style={{ flex: 1, pointerEvents: "auto", display: sceneReady ? "block" : "none" }}>
            <BuildingView />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
