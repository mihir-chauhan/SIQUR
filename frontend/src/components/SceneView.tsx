"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

// Patch Three.js to use BVH-accelerated raycasting globally
// @ts-expect-error — three-mesh-bvh monkey-patches prototypes
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-expect-error
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * SceneView — Full-viewport 3D renderer.
 * Gaussian splat + OBJ mesh in the same Three.js scene.
 * WASD + click-drag mouse look + camera placement via raycast.
 */
export interface SceneObjects {
  splatGroup: THREE.Object3D | null;
  objGroup: THREE.Group | null;
}

export interface CameraPlacement {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  mesh: THREE.Mesh;
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
  onObjectsReady,
  onCameraPlaced,
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
  onObjectsReady?: (objects: SceneObjects) => void;
  onCameraPlaced?: (placement: CameraPlacement) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const placementModeRef = useRef(false);
  const onCameraPlacedRef = useRef(onCameraPlaced);
  const splatVisibleRef = useRef(splatVisible ?? true);
  const objVisibleRef = useRef(objVisible ?? true);

  // Keep refs in sync with props every render
  placementModeRef.current = placementMode ?? false;
  onCameraPlacedRef.current = onCameraPlaced;
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
        sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
        threeScene: threeScene,
        ignoreDevicePixelRatio: false,
      });

      viewer
        .addSplatScene(splatPath, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: true,
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
                  // @ts-expect-error — patched by three-mesh-bvh
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

      // --- WASD + Mouse Look (FPS style) ---
      const keys: Record<string, boolean> = {};
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      const baseSpeed = 7.5; // units/sec — fast enough for large scenes
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

      const markerGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.9,
      });

      const onKeyDown = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === "Shift") keys["shift"] = true;
      };
      const onKeyUp = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === "Shift") keys["shift"] = false;
      };
      const onMouseDown = (e: MouseEvent) => {
        if (e.button === 0) {
          isDragging = true;
          didDrag = false;
          mouseDownPos = { x: e.clientX, y: e.clientY };
        }
      };
      const onMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
          isDragging = false;

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

              // Spawn marker
              const marker = new THREE.Mesh(markerGeo, markerMat.clone());
              marker.position.copy(hit.point);
              // Offset slightly along normal to prevent z-fighting
              marker.position.addScaledVector(worldNormal, 0.02);
              threeScene.add(marker);

              console.log("[SceneView] Camera placed at", hit.point);

              if (onCameraPlacedRef.current) {
                onCameraPlacedRef.current({
                  position: hit.point.clone(),
                  normal: worldNormal,
                  mesh: marker,
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
        forward.y = 0;
        forward.normalize();

        // Right direction (up is -Y in this scene)
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, -1, 0)).normalize();

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
  );
}
