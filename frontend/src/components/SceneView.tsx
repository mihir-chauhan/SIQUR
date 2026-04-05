"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

// Patch Three.js to use BVH-accelerated raycasting globally
// @ts-ignore — three-mesh-bvh monkey-patches prototypes
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-ignore
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const TERMINAL_LINES = [
  "INITIALIZING GAUSSIAN SPLAT RECONSTRUCTION...",
  "LOADING POINT CLOUD — 2.4M VERTICES",
  "COMPUTING SPHERICAL HARMONICS COEFFICIENTS...",
  "BUILDING SPATIAL HASH GRID — 128x128x64",
  "CAMERA ENDPOINT PLACEMENT — ANALYZING 4 NODES",
  "RUNNING OR-TOOLS COVERAGE OPTIMIZER...",
  "SOLVING SET-COVER ILP — 847 CANDIDATE POSITIONS",
  "OPTIMAL COVERAGE: 94.2% — 4 CAMERAS PLACED",
  "COMPUTING VIEWING CONE INTERSECTIONS...",
  "DEAD ZONE ANALYSIS — 3 BLIND SPOTS DETECTED",
  "GENERATING FLOOR PLAN OVERLAY...",
  "TEXTURE ATLAS STREAMING — 5 MATERIALS LOADED",
  "ENVIRONMENT MAP CALIBRATION COMPLETE",
  "MESH TOPOLOGY VALIDATION — 736K FACES",
  "BVH ACCELERATION TREE — DEPTH 14 NODES",
  "RAYCASTING ENGINE INITIALIZED",
  "SECURITY PERIMETER BOUNDARY DEFINED",
  "THREAT VECTOR ANALYSIS — 12 ENTRY POINTS",
  "FIELD OF VIEW OPTIMIZATION — 4 CONES PLACED",
  "NEURAL SURVEILLANCE KERNEL READY",
  "SYNTHETIC DATASET GENERATOR — STANDBY",
  "FINALIZING 3D SCENE COMPOSITION...",
];

function LoadingTerminal({ onComplete }: { onComplete?: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      const now = new Date();
      const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const line = `[${ts}] ${TERMINAL_LINES[idx]}`;
      setLines((prev) => [...prev.slice(-11), line]);
      if (idx >= TERMINAL_LINES.length - 1) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
      idx++;
    }, 450);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={containerRef}
      style={{
        marginTop: 32,
        width: 420,
        maxHeight: 180,
        overflow: "hidden",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 9,
        lineHeight: 1.8,
        letterSpacing: "0.08em",
        textAlign: "left",
      }}
    >
      {lines.map((line, i) => {
        const isLatest = i === lines.length - 1;
        const fade = Math.max(0.12, (i + 1) / lines.length);
        return (
          <div
            key={`${i}-${line}`}
            style={{
              color: isLatest ? "rgba(0, 229, 255, 0.85)" : `rgba(0, 229, 255, ${fade * 0.5})`,
              whiteSpace: "nowrap",
              transition: "color 300ms ease",
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

/**
 * SceneView — Full-viewport 3D renderer.
 * Gaussian splat + OBJ mesh in the same Three.js scene.
 * WASD + click-drag mouse look + camera placement via raycast.
 */
export interface SceneObjects {
  splatGroup: THREE.Object3D | null;
  objGroup: THREE.Group | null;
}

export interface SceneHandle {
  captureCamera: () => { position: { x: number; y: number; z: number }; yaw: number } | null;
  spawnMarker: (id: string, pos: { x: number; y: number; z: number }, yaw: number) => THREE.Group | null;
  getMarker: (id: string) => THREE.Object3D | null;
}

export interface CameraPlacement {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  mesh: THREE.Mesh;
  yaw: number;   // degrees
  pitch: number; // degrees
}

export default function SceneView({
  splatPath,
  objPath,
  mtlPath,
  placementMode,
  splatVisible,
  objVisible,
  objPosition,
  objRotation,
  objScale,
  hardcodedCameras,
  sceneRef,
  onObjectsReady,
  onCameraPlaced,
  onCameraClicked,
  onSplatLoaded,
}: {
  splatPath: string;
  objPath?: string;
  mtlPath?: string;
  placementMode?: boolean;
  splatVisible?: boolean;
  objVisible?: boolean;
  objPosition?: { x: number; y: number; z: number };
  objRotation?: { x: number; y: number; z: number };
  objScale?: { x: number; y: number; z: number };
  hardcodedCameras?: Array<{ id: string; pos: { x: number; y: number; z: number }; yaw: number }>;
  sceneRef?: React.MutableRefObject<SceneHandle | null>;
  onObjectsReady?: (objects: SceneObjects) => void;
  onCameraPlaced?: (placement: CameraPlacement) => void;
  onCameraClicked?: (cameraId: string) => void;
  onSplatLoaded?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const placementModeRef = useRef(false);
  const [splatReady, setSplatReady] = useState(false);
  const [terminalDone, setTerminalDone] = useState(false);
  const onCameraPlacedRef = useRef(onCameraPlaced);
  const onCameraClickedRef = useRef(onCameraClicked);
  const splatVisibleRef = useRef(splatVisible ?? true);
  const objVisibleRef = useRef(objVisible ?? true);

  // Keep refs in sync with props every render
  placementModeRef.current = placementMode ?? false;
  onCameraPlacedRef.current = onCameraPlaced;
  onCameraClickedRef.current = onCameraClicked;
  splatVisibleRef.current = splatVisible ?? true;
  objVisibleRef.current = objVisible ?? true;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let destroyed = false;

    async function init() {
      const GaussianSplats3D = await import("@mkkellogg/gaussian-splats-3d");
      if (destroyed) return;

      const threeScene = new THREE.Scene();

      // Wrapper group for OBJ — we control visibility/position on this
      const objWrapper = new THREE.Group();
      objWrapper.name = "obj-wrapper";
      if (objPosition) objWrapper.position.set(objPosition.x, objPosition.y, objPosition.z);
      if (objRotation) {
        const d = Math.PI / 180;
        objWrapper.rotation.set(objRotation.x * d, objRotation.y * d, objRotation.z * d);
      }
      if (objScale) objWrapper.scale.set(objScale.x, objScale.y, objScale.z);
      threeScene.add(objWrapper);

      const sceneObjects: SceneObjects = {
        splatGroup: null,
        objGroup: objWrapper,
      };

      // Create the Viewer
      const viewer = new GaussianSplats3D.Viewer({
        rootElement: container,
        cameraUp: [0, -1, 0],
        initialCameraPosition: [0, -0.5, -8],
        initialCameraLookAt: [0, 0, 0],
        selfDrivenMode: false,
        useBuiltInControls: false,
        sharedMemoryForWorkers: false,
        integerBasedSort: false,
        dynamicScene: false,
        // @ts-ignore — SceneRevealMode exists at runtime
        sceneRevealMode: GaussianSplats3D.SceneRevealMode?.Gradual ?? 1,
        threeScene: threeScene,
        ignoreDevicePixelRatio: false,
      });

      viewer
        .addSplatScene(splatPath, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          progressiveLoad: true,
        })
        .then(() => {
          console.log("[SceneView] Splat loaded successfully");
          // Grab the viewer's splatMesh — this is the actual renderable
          const splatMesh = (viewer as unknown as { splatMesh: THREE.Object3D }).splatMesh;
          if (splatMesh) {
            sceneObjects.splatGroup = splatMesh;
            if (onObjectsReady) onObjectsReady(sceneObjects);
          }
          setSplatReady(true);
          if (onSplatLoaded) onSplatLoaded();
        })
        .catch((err: unknown) => {
          console.error("[SceneView] Splat load error:", err);
        });

      // --- Lights (for OBJ mesh textures) ---
      threeScene.add(new THREE.AmbientLight(0xffffff, 1.0));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
      dirLight.position.set(5, -5, 5);
      threeScene.add(dirLight);

      // --- OBJ + MTL mesh (interior scan) ---
      if (objPath && mtlPath) {
        const mtlLoader = new MTLLoader();
        // Set the path so texture references in .mtl resolve correctly
        const mtlDir = mtlPath.substring(0, mtlPath.lastIndexOf("/") + 1);
        mtlLoader.setPath(mtlDir);
        const mtlFile = mtlPath.substring(mtlPath.lastIndexOf("/") + 1);

        mtlLoader.load(mtlFile, (materials) => {
          materials.preload();
          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.load(
            objPath,
            (obj) => {
              console.log("[SceneView] OBJ loaded successfully");
              obj.rotation.x = Math.PI;

              // BVH acceleration + DoubleSide for raycasting
              obj.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  // @ts-ignore — patched by three-mesh-bvh
                  mesh.geometry.computeBoundsTree();
                  if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => (m.side = THREE.DoubleSide));
                  } else {
                    mesh.material.side = THREE.DoubleSide;
                  }
                }
              });
              console.log("[SceneView] BVH computed for OBJ meshes");

              objWrapper.add(obj);
              if (onObjectsReady) onObjectsReady(sceneObjects);
            },
            undefined,
            (err) => {
              console.error("[SceneView] OBJ load error:", err);
            }
          );
        });
      }

      // Get the viewer's renderer and camera so we drive them ourselves
      const renderer: THREE.WebGLRenderer = (viewer as unknown as { renderer: THREE.WebGLRenderer }).renderer;
      const camera: THREE.PerspectiveCamera = (viewer as unknown as { camera: THREE.PerspectiveCamera }).camera;

      // Expose capture + spawn functions via ref
      if (sceneRef) {
        sceneRef.current = {
          captureCamera: () => {
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const yaw = ((Math.atan2(dir.x, dir.z) * 180) / Math.PI + 360) % 360;
            return {
              position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
              yaw,
            };
          },
          spawnMarker: (id: string, pos: { x: number; y: number; z: number }, yaw: number) => {
            return createMarker(id, pos, yaw);
          },
          getMarker: (id: string) => {
            for (const [obj, mid] of markerIdMap) {
              if (mid === id) return obj;
            }
            return null;
          },
        };
      }

      // --- WASD + Mouse Look (FPS style) ---
      const keys: Record<string, boolean> = {};
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      const baseSpeed = 1.875; // units/sec — fast enough for large scenes
      const shiftMultiplier = 3; // 3x speed when holding shift
      const lookSpeed = 0.004;
      let isDragging = false;
      let didDrag = false;
      let mouseDownPos = { x: 0, y: 0 };

      // Initialize euler from current camera orientation
      euler.setFromQuaternion(camera.quaternion);

      // --- Raycaster for camera placement ---
      const raycaster = new THREE.Raycaster();
      raycaster.firstHitOnly = true;
      const pointer = new THREE.Vector2();

      const markerGeo = new THREE.SphereGeometry(0.03, 12, 12);
      const markerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
      });
      // Vision cone: 90° FOV, ~2m length, very transparent
      const coneFov = 90;
      const coneLength = 2;
      const coneRadius = Math.tan((coneFov / 2) * Math.PI / 180) * coneLength;
      const coneGeo = new THREE.ConeGeometry(coneRadius, coneLength, 24, 1, true);
      // Shift geometry so the tip is at origin (camera position)
      coneGeo.translate(0, -coneLength / 2, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const markerIdMap = new Map<THREE.Object3D, string>();
      let camCounter = 0;

      // Shared function: spawn a camera marker at pos facing yaw
      function createMarker(id: string, pos: { x: number; y: number; z: number }, yaw: number): THREE.Group {
        const d = Math.PI / 180;
        const yawRad = yaw * d;
        const inward = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad)).normalize();
        const defDir = new THREE.Vector3(0, -1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(defDir, inward);

        const mg = new THREE.Group();
        mg.position.set(pos.x, pos.y, pos.z);

        mg.add(new THREE.Mesh(markerGeo, markerMat.clone()));

        const c = new THREE.Mesh(coneGeo.clone(), coneMat.clone());
        c.quaternion.copy(q);
        c.name = "cone";
        mg.add(c);

        const le = inward.clone().multiplyScalar(3);
        const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), le]);
        const lm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        const al = new THREE.Line(lg, lm);
        al.name = "aimline";
        mg.add(al);

        threeScene.add(mg);
        markerIdMap.set(mg, id);
        return mg;
      }

      // Spawn hardcoded camera markers
      if (hardcodedCameras) {
        for (const hc of hardcodedCameras) {
          createMarker(hc.id, hc.pos, hc.yaw);
          camCounter = Math.max(camCounter, parseInt(hc.id.replace("cam_", "")) || 0);
        }
      }

      const onKeyDown = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === "Shift") keys["shift"] = true;
      };
      const onKeyUp = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === "Shift") keys["shift"] = false;
      };
      let mouseDownOnCanvas = false;
      const onMouseDown = (e: MouseEvent) => {
        // Only handle clicks directly on the canvas
        if (e.button === 0 && e.target === renderer.domElement) {
          isDragging = true;
          didDrag = false;
          mouseDownOnCanvas = true;
          mouseDownPos = { x: e.clientX, y: e.clientY };
        }
      };
      const onMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
          isDragging = false;
          if (!mouseDownOnCanvas) return;
          mouseDownOnCanvas = false;

          if (!didDrag && !placementModeRef.current) {
            // Not in placement mode — check if clicked a camera marker
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);

            const markers = Array.from(markerIdMap.keys());
            if (markers.length > 0) {
              const markerHits = raycaster.intersectObjects(markers, true);
              if (markerHits.length > 0) {
                // Walk up to find which group was hit
                let hitObj: THREE.Object3D | null = markerHits[0].object;
                while (hitObj && !markerIdMap.has(hitObj)) {
                  hitObj = hitObj.parent;
                }
                const hitId = hitObj ? markerIdMap.get(hitObj) : undefined;
                if (hitId && onCameraClickedRef.current) {
                  onCameraClickedRef.current(hitId);
                  return;
                }
              }
            }
          }

          // If didn't drag and in placement mode, do raycast
          if (!didDrag && placementModeRef.current) {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);

            const hits = raycaster.intersectObjects([objWrapper], true);
            if (hits.length > 0) {
              const hit = hits[0];
              const worldNormal = hit.face!.normal
                .clone()
                .transformDirection(hit.object.matrixWorld);

              // Spawn marker group (orb + vision cone)
              const markerGroup = new THREE.Group();
              markerGroup.position.copy(hit.point);
              markerGroup.position.addScaledVector(worldNormal, 0.02);

              // White orb
              const marker = new THREE.Mesh(markerGeo, markerMat.clone());
              markerGroup.add(marker);

              // Vision cone pointing inward (along -normal)
              const cone = new THREE.Mesh(coneGeo.clone(), coneMat.clone());
              // Default cone points along -Y. Rotate to point along inward direction.
              const inwardDir = worldNormal.clone().negate();
              const defaultDir = new THREE.Vector3(0, -1, 0);
              const coneQuat = new THREE.Quaternion().setFromUnitVectors(defaultDir, inwardDir);
              cone.quaternion.copy(coneQuat);
              cone.name = "cone";
              markerGroup.add(cone);

              // Aim line — uses same inwardDir as the cone
              const lineEnd = inwardDir.clone().multiplyScalar(3);
              const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                lineEnd,
              ]);
              const lineMat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
              });
              const aimLine = new THREE.Line(lineGeo, lineMat);
              aimLine.name = "aimline";
              markerGroup.add(aimLine);

              threeScene.add(markerGroup);

              camCounter++;
              markerIdMap.set(markerGroup, `cam_${camCounter}`);

              // Compute yaw from inward direction (opposite of surface normal)
              const inward = worldNormal.clone().negate();
              const yawRad = Math.atan2(inward.x, inward.z);
              const yawDeg = ((yawRad * 180) / Math.PI + 360) % 360;
              const pitchDeg = -20; // default wall mount pitch

              console.log("[SceneView] Camera placed at", hit.point, "yaw:", yawDeg.toFixed(1));

              if (onCameraPlacedRef.current) {
                onCameraPlacedRef.current({
                  position: hit.point.clone(),
                  normal: worldNormal,
                  mesh: markerGroup as unknown as THREE.Mesh,
                  yaw: yawDeg,
                  pitch: pitchDeg,
                });
              }
            }
          }
        }
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        // Detect if mouse actually moved (threshold of 3px)
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;

        if (didDrag) {
          euler.y -= e.movementX * lookSpeed;
          euler.x -= e.movementY * lookSpeed;
          euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
          camera.quaternion.setFromEuler(euler);
        }
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      renderer.domElement.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("mousemove", onMouseMove);

      // --- Resize ---
      const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      // --- Animation loop ---
      const clock = new THREE.Clock();

      function animate() {
        if (destroyed) return;
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const speed = baseSpeed * (keys["shift"] ? shiftMultiplier : 1) * delta;

        // Forward/back direction based on where camera is looking
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);

        // Right direction — strafe stays horizontal
        const flatForward = forward.clone();
        flatForward.y = 0;
        flatForward.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(flatForward, new THREE.Vector3(0, -1, 0)).normalize();

        if (keys["w"]) camera.position.addScaledVector(forward, speed);
        if (keys["s"]) camera.position.addScaledVector(forward, -speed);
        if (keys["a"]) camera.position.addScaledVector(right, -speed);
        if (keys["d"]) camera.position.addScaledVector(right, speed);

        // Apply visibility every frame (viewer may reset it otherwise)
        objWrapper.visible = objVisibleRef.current;
        const splatMesh = (viewer as unknown as { splatMesh: THREE.Object3D }).splatMesh;
        if (splatMesh) splatMesh.visible = splatVisibleRef.current;

        viewer.update();
        viewer.render();
      }
      animate();

      // --- Cleanup ---
      cleanupRef.current = () => {
        destroyed = true;
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        viewer.dispose();
      };
    }

    init();

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [splatPath, objPath, mtlPath]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          background: "#0a0a0a",
        }}
      />

      {/* Custom loading overlay — replaces the library's gray box */}
      {(!splatReady || !terminalDone) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(ellipse at center, rgba(0, 20, 30, 0.95) 0%, rgba(10, 10, 10, 0.98) 70%)",
            pointerEvents: "none",
          }}
        >
          {/* Scanning ring animation */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              border: "2px solid rgba(0, 229, 255, 0.15)",
              borderTopColor: "rgba(0, 229, 255, 0.8)",
              animation: "spin 1.2s linear infinite",
              marginBottom: 32,
              boxShadow: "0 0 20px rgba(0, 229, 255, 0.15), inset 0 0 20px rgba(0, 229, 255, 0.05)",
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.35em",
              color: "#00e5ff",
              textShadow: "0 0 12px rgba(0, 229, 255, 0.5), 0 0 30px rgba(0, 229, 255, 0.2)",
              animation: "pulse-text 2s ease-in-out infinite",
            }}
          >
            RUNNING AI ANALYSIS
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 9,
              letterSpacing: "0.25em",
              color: "rgba(0, 229, 255, 0.35)",
              marginTop: 12,
            }}
          >
            PROCESSING ENVIRONMENT DATA
          </div>

          {/* Terminal log feed */}
          <LoadingTerminal onComplete={() => setTerminalDone(true)} />

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            @keyframes pulse-text {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
