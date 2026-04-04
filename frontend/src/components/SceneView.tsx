"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

/**
 * SceneView — Full-viewport 3D renderer.
 * Gaussian splat + OBJ mesh in the same Three.js scene.
 * WASD + click-drag mouse look.
 */
export interface SceneObjects {
  splatGroup: THREE.Group | null;
  objGroup: THREE.Group | null;
}

export default function SceneView({
  splatPath,
  objPath,
  mtlPath,
  onObjectsReady,
}: {
  splatPath: string;
  objPath?: string;
  mtlPath?: string;
  onObjectsReady?: (objects: SceneObjects) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

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

      // Initialize euler from current camera orientation
      euler.setFromQuaternion(camera.quaternion);

      const onKeyDown = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === "Shift") keys["shift"] = true;
      };
      const onKeyUp = (e: KeyboardEvent) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === "Shift") keys["shift"] = false;
      };
      const onMouseDown = (e: MouseEvent) => {
        if (e.button === 0) isDragging = true; // left click
      };
      const onMouseUp = (e: MouseEvent) => {
        if (e.button === 0) isDragging = false;
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        euler.y -= e.movementX * lookSpeed;
        euler.x -= e.movementY * lookSpeed;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
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

        // Let the viewer update its internal state and render
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
