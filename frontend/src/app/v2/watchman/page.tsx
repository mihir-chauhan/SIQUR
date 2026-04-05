"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ModeSidebar from "@/components/ModeSidebar";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

/**
 * Watchman — synchronized motion tracking viewer.
 * Left: OBJ interior with standalone Three.js (no GaussianSplats3D, normal Y-up).
 * Right: 4 stacked video feeds (placeholder until videos provided).
 */

const VIDEO_FEEDS = [
  { id: "cam_h1", label: "CAM-H1", src: "" },
  { id: "cam_h2", label: "CAM-H2", src: "" },
  { id: "cam_h3", label: "CAM-H3", src: "" },
  { id: "cam_h4", label: "CAM-H4", src: "" },
];

export default function WatchmanPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [objReady, setObjReady] = useState(false);
  const [camData, setCamData] = useState({ x: 0, y: 0, z: 0, yaw: 0 });
  const camDataRef = useRef(camData);
  const [pathPlaying, setPathPlaying] = useState(false);
  const pathPlayingRef = useRef(false);
  const [envOpacity, setEnvOpacity] = useState(1.0);
  const objWrapperRef = useRef<THREE.Group | null>(null);
  const [xrayEnabled, setXrayEnabled] = useState(false);
  const dotRef = useRef<THREE.Mesh | null>(null);
  const trailLineRef = useRef<THREE.Line | null>(null);
  const waypointsRef = useRef<Array<{ x: number; y: number; z: number; speed: number }>>([]);
  const [waypointCount, setWaypointCount] = useState(0);

  // DEV: Spacebar records a waypoint, logs to console
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        const d = camDataRef.current;
        const pt = { x: +d.x.toFixed(2), y: +d.y.toFixed(2), z: +d.z.toFixed(2), speed: 1.0 };
        waypointsRef.current.push(pt);
        setWaypointCount(waypointsRef.current.length);
        console.log(`[WAYPOINT ${waypointsRef.current.length}]`, JSON.stringify(pt));
        console.log("ALL WAYPOINTS:", JSON.stringify(waypointsRef.current, null, 2));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Update OBJ opacity when slider changes
  useEffect(() => {
    const wrapper = objWrapperRef.current;
    if (!wrapper) return;
    wrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mats = Array.isArray((child as THREE.Mesh).material)
          ? (child as THREE.Mesh).material as THREE.Material[]
          : [(child as THREE.Mesh).material];
        mats.forEach((m) => {
          (m as THREE.MeshStandardMaterial).opacity = envOpacity;
          (m as THREE.MeshStandardMaterial).depthWrite = envOpacity >= 1.0;
        });
      }
    });
  }, [envOpacity]);

  // X-ray toggle: make dot + trail render on top of all geometry
  useEffect(() => {
    const dot = dotRef.current;
    const trail = trailLineRef.current;
    if (dot) {
      dot.renderOrder = xrayEnabled ? 999 : 0;
      (dot.material as THREE.MeshBasicMaterial).depthTest = !xrayEnabled;
      (dot.material as THREE.MeshBasicMaterial).depthWrite = !xrayEnabled;
    }
    if (trail) {
      trail.renderOrder = xrayEnabled ? 999 : 0;
      (trail.material as THREE.LineBasicMaterial).depthTest = !xrayEnabled;
      (trail.material as THREE.LineBasicMaterial).depthWrite = !xrayEnabled;
    }
  }, [xrayEnabled]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let destroyed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const width = container.clientWidth;
    const height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 1000);
    // Normal Y-up — no inversion
    camera.position.set(-3.18, 5.81, 13.75);
    // Yaw 1.6 degrees
    const yawRad = 3.4 * (Math.PI / 180);
    const lookTarget = new THREE.Vector3(
      -3.18 + Math.sin(yawRad),
      5.81 - 0.3,
      13.75 + Math.cos(yawRad)
    );
    camera.lookAt(lookTarget);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Load OBJ + MTL — same files as placement, no rotation.x flip needed
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath("/models/interior/");
    mtlLoader.load("4_4_2026.mtl", (materials) => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load("/models/interior/4_4_2026.obj", (obj) => {
        if (destroyed) return;

        const objWrapper = new THREE.Group();
        objWrapper.position.set(-1.65, 0.6, 16.9);
        const d = Math.PI / 180;
        objWrapper.rotation.set(0, -267.5 * d, 0);
        objWrapper.scale.set(0.25, 0.25, 0.25);
        objWrapper.add(obj);

        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              m.side = THREE.DoubleSide;
              m.transparent = true; // enable once so no shader recompile on slider drag
            });
          }
        });

        scene.add(objWrapper);
        objWrapperRef.current = objWrapper;

        // --- Animated path ---
        const WAYPOINTS = [
          {x:-7.53,y:0.76,z:19.53,speed:1},{x:-7.75,y:0.77,z:19.4,speed:1},
          {x:-7.85,y:0.75,z:19.18,speed:1},{x:-7.87,y:0.75,z:18.95,speed:1},
          {x:-7.88,y:0.74,z:18.77,speed:1},{x:-7.88,y:0.74,z:18.46,speed:1},
          {x:-7.9,y:0.75,z:18.34,speed:1},{x:-7.9,y:0.75,z:18.2,speed:1},
          {x:-7.89,y:0.76,z:18.01,speed:1},{x:-7.89,y:0.77,z:17.85,speed:1},
          {x:-7.89,y:0.77,z:17.66,speed:1},{x:-7.88,y:0.77,z:17.41,speed:1},
          {x:-7.87,y:0.77,z:17.22,speed:1},{x:-7.86,y:0.77,z:17.02,speed:1},
          {x:-7.85,y:0.76,z:16.81,speed:1},{x:-7.84,y:0.76,z:16.59,speed:1},
          {x:-7.82,y:0.75,z:16.48,speed:1},{x:-7.8,y:0.75,z:16.36,speed:1},
          {x:-7.79,y:0.74,z:16.25,speed:1},{x:-7.76,y:0.72,z:16.09,speed:1},
          {x:-7.72,y:0.72,z:16.06,speed:1},{x:-7.63,y:0.74,z:16,speed:1},
          {x:-7.48,y:0.77,z:15.95,speed:1},{x:-7.37,y:0.78,z:15.93,speed:1},
          {x:-7.15,y:0.8,z:15.88,speed:1},{x:-6.73,y:0.83,z:15.82,speed:1},
          {x:-6.53,y:0.81,z:15.79,speed:1},{x:-6.32,y:0.78,z:15.75,speed:1},
          {x:-6.08,y:0.77,z:15.73,speed:1},{x:-5.84,y:0.75,z:15.78,speed:1},
          {x:-5.49,y:0.76,z:15.81,speed:1},{x:-4.91,y:0.74,z:15.82,speed:1},
          {x:-4.6,y:0.67,z:15.84,speed:1},{x:-4.27,y:0.69,z:15.8,speed:1},
          {x:-4.03,y:0.65,z:15.79,speed:1},{x:-3.87,y:0.63,z:15.8,speed:1},
          {x:-3.44,y:0.6,z:15.69,speed:1},{x:-2.97,y:0.52,z:15.77,speed:1},
          {x:-2.75,y:0.49,z:15.75,speed:1},{x:-2.37,y:0.52,z:15.76,speed:1},
          {x:-2.02,y:0.54,z:15.75,speed:1},{x:-1.8,y:0.55,z:15.8,speed:1},
          {x:-1.26,y:0.61,z:15.93,speed:1},{x:-0.79,y:0.62,z:16.24,speed:1},
          {x:-0.44,y:0.59,z:16.65,speed:1},{x:-0.28,y:0.58,z:17.22,speed:1},
          {x:-0.19,y:0.6,z:17.57,speed:1},{x:-0.13,y:0.6,z:18.2,speed:1},
          {x:0,y:0.6,z:18.52,speed:1},{x:0.16,y:0.59,z:18.97,speed:1},
        ];

        const curvePoints = WAYPOINTS.map(w => new THREE.Vector3(w.x, w.y, w.z));
        const curve = new THREE.CatmullRomCurve3(curvePoints, false, "catmullrom", 0.5);

        // Glowing dot (the "person")
        const dotGeo = new THREE.SphereGeometry(0.06, 16, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        scene.add(dot);
        dotRef.current = dot;

        // Fading trail line
        const TRAIL_LENGTH = 200;
        const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
        const trailColors = new Float32Array(TRAIL_LENGTH * 4);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setAttribute("color", new THREE.BufferAttribute(trailColors, 4));
        const trailMat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);
        trailLineRef.current = trailLine;

        // Animation state
        let pathT = 0;
        const PATH_SPEED = 0.02; // global speed multiplier — full path in ~50s
        let trailHead = 0;
        let trailFilled = false;

        // Store reference for animate loop
        (scene as unknown as { _pathAnim: { curve: THREE.CatmullRomCurve3; dot: THREE.Mesh; trailGeo: THREE.BufferGeometry; trailPositions: Float32Array; trailColors: Float32Array; pathT: number; trailHead: number; trailFilled: boolean } }).
          _pathAnim = { curve, dot, trailGeo, trailPositions, trailColors, pathT, trailHead, trailFilled };

        setObjReady(true);
      });
    });

    // WASD + Mouse Look
    const keys: Record<string, boolean> = {};
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const baseSpeed = 0.5;
    const shiftMultiplier = 6;
    const lookSpeed = 0.004;
    let isDragging = false;
    let didDrag = false;
    let mouseDownPos = { x: 0, y: 0 };

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
      if (e.button === 0 && e.target === renderer.domElement) {
        isDragging = true;
        didDrag = false;
        mouseDownPos = { x: e.clientX, y: e.clientY };
      }
    };
    const onMouseUp = () => { isDragging = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      if (Math.abs(e.clientX - mouseDownPos.x) > 3 || Math.abs(e.clientY - mouseDownPos.y) > 3) didDrag = true;
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

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    function animate() {
      if (destroyed) return;
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const speed = baseSpeed * (keys["shift"] ? shiftMultiplier : 1) * delta;

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);

      const flatForward = forward.clone();
      flatForward.y = 0;
      flatForward.normalize();
      const right = new THREE.Vector3();
      right.crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();

      if (keys["w"]) camera.position.addScaledVector(forward, speed);
      if (keys["s"]) camera.position.addScaledVector(forward, -speed);
      if (keys["a"]) camera.position.addScaledVector(right, -speed);
      if (keys["d"]) camera.position.addScaledVector(right, speed);

      // Update camera data for overlay
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const yaw = ((Math.atan2(dir.x, dir.z) * 180) / Math.PI + 360) % 360;
      const newData = { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw };
      camDataRef.current = newData;

      // Animate path dot + trail
      const anim = (scene as unknown as { _pathAnim?: { curve: THREE.CatmullRomCurve3; dot: THREE.Mesh; trailGeo: THREE.BufferGeometry; trailPositions: Float32Array; trailColors: Float32Array; pathT: number; trailHead: number; trailFilled: boolean } })._pathAnim;
      if (anim && pathPlayingRef.current) {
        anim.pathT += delta * 0.1;
        if (anim.pathT > 1) {
          anim.pathT = 0;
          anim.trailHead = 0;
          anim.trailFilled = false;
          pathPlayingRef.current = false;
          setPathPlaying(false);
        }

        const pos = anim.curve.getPoint(anim.pathT);
        anim.dot.position.copy(pos);

        // Add to trail ring buffer
        const i3 = anim.trailHead * 3;
        anim.trailPositions[i3] = pos.x;
        anim.trailPositions[i3 + 1] = pos.y;
        anim.trailPositions[i3 + 2] = pos.z;

        // Update trail colors (fade from head)
        const TRAIL_LENGTH = 200;
        for (let t = 0; t < TRAIL_LENGTH; t++) {
          const age = (anim.trailHead - t + TRAIL_LENGTH) % TRAIL_LENGTH;
          const maxAge = anim.trailFilled ? TRAIL_LENGTH : anim.trailHead + 1;
          const alpha = maxAge > 0 ? Math.max(0, 1 - age / maxAge) : 0;
          const i4 = t * 4;
          anim.trailColors[i4] = 0;
          anim.trailColors[i4 + 1] = 0.9;
          anim.trailColors[i4 + 2] = 1;
          anim.trailColors[i4 + 3] = alpha * 0.6;
        }

        anim.trailHead = (anim.trailHead + 1) % TRAIL_LENGTH;
        if (anim.trailHead === 0) anim.trailFilled = true;

        anim.trailGeo.attributes.position.needsUpdate = true;
        anim.trailGeo.attributes.color.needsUpdate = true;
      }

      renderer.render(scene, camera);
    }
    animate();

    // Push cam data to React state at 10fps (not every frame)
    const stateInterval = setInterval(() => {
      setCamData({ ...camDataRef.current });
    }, 100);

    return () => {
      destroyed = true;
      clearInterval(stateInterval);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      try {
        if (renderer.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch { /* cleanup race */ }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0a0a",
      }}
    >
      <ModeSidebar />

      {/* Loading overlay */}
      {!objReady && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 48,
            right: 0,
            bottom: 0,
            zIndex: 50,
            background: "radial-gradient(ellipse at center, rgba(0, 20, 30, 0.95) 0%, rgba(10, 10, 10, 0.98) 70%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid rgba(0, 229, 255, 0.15)",
              borderTopColor: "rgba(0, 229, 255, 0.8)",
              animation: "wm-spin 1s linear infinite",
              marginBottom: 20,
              boxShadow: "0 0 20px rgba(0, 229, 255, 0.15)",
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
          <style>{`@keyframes wm-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Main content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 48,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid rgba(0, 229, 255, 0.1)",
            background: "rgba(6, 6, 6, 0.9)",
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 9,
              letterSpacing: "0.3em",
              color: "rgba(0, 229, 255, 0.6)",
            }}
          >
            WATCHMAN // MOTION TRACKING // HALL OF DATA SCIENCE AND AI
          </span>
        </div>

        {/* Split view */}
        <div style={{ flex: 1, display: "flex", position: "relative" }}>
          {/* Left: 3D OBJ Viewer (70%) */}
          <div style={{ width: "70%", height: "100%", position: "relative" }}>
            <div
              ref={containerRef}
              style={{ position: "absolute", inset: 0 }}
            />

            {/* Camera coordinates overlay */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
                pointerEvents: "none",
              }}
            >
              <span>X: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.x.toFixed(2)}</span></span>
              <span>Y: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.y.toFixed(2)}</span></span>
              <span>Z: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.z.toFixed(2)}</span></span>
              <span style={{ marginTop: 4 }}>YAW: <span style={{ color: "rgba(0, 229, 255, 0.7)" }}>{camData.yaw.toFixed(1)}</span>&deg;</span>
              <span style={{ marginTop: 8, color: "#ffdd44", fontSize: 9 }}>WAYPOINTS: {waypointCount} [SPACE]</span>

              {/* Environment opacity slider */}
              <div style={{ marginTop: 14, pointerEvents: "auto", padding: "8px 10px", background: "rgba(0,0,0,0.6)", borderRadius: 4, border: "1px solid rgba(0, 229, 255, 0.15)" }}>
                <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(0, 229, 255, 0.6)", display: "block", marginBottom: 6 }}>
                  ENV OPACITY: {Math.round(envOpacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(envOpacity * 100)}
                  onChange={(e) => setEnvOpacity(Number(e.target.value) / 100)}
                  style={{
                    display: "block",
                    width: 130,
                    height: 4,
                    accentColor: "#00e5ff",
                    cursor: "pointer",
                  }}
                />
              </div>
              {/* X-ray toggle */}
              <button
                onClick={() => setXrayEnabled((v) => !v)}
                style={{
                  marginTop: 8,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: xrayEnabled ? "#0a0a0a" : "#00e5ff",
                  background: xrayEnabled ? "#00e5ff" : "rgba(0, 229, 255, 0.1)",
                  border: "1px solid rgba(0, 229, 255, 0.3)",
                  borderRadius: 3,
                  padding: "6px 12px",
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              >
                {xrayEnabled ? "X-RAY ON" : "X-RAY OFF"}
              </button>

              <div style={{ display: "flex", gap: 6, marginTop: 8, pointerEvents: "auto" }}>
                <button
                  onClick={() => {
                    pathPlayingRef.current = true;
                    setPathPlaying(true);
                  }}
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: pathPlaying ? "rgba(0, 229, 255, 0.3)" : "#00e5ff",
                    background: "rgba(0, 229, 255, 0.1)",
                    border: "1px solid rgba(0, 229, 255, 0.3)",
                    borderRadius: 3,
                    padding: "6px 12px",
                    cursor: pathPlaying ? "default" : "pointer",
                  }}
                >
                  PLAY
                </button>
                <button
                  onClick={() => {
                    pathPlayingRef.current = false;
                    setPathPlaying(false);
                  }}
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: !pathPlaying ? "rgba(0, 229, 255, 0.3)" : "#00e5ff",
                    background: "rgba(0, 229, 255, 0.1)",
                    border: "1px solid rgba(0, 229, 255, 0.3)",
                    borderRadius: 3,
                    padding: "6px 12px",
                    cursor: !pathPlaying ? "default" : "pointer",
                  }}
                >
                  PAUSE
                </button>
              </div>
            </div>
          </div>

          {/* Right: Video feeds (30%) */}
          <div
            style={{
              width: "30%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid rgba(0, 229, 255, 0.1)",
            }}
          >
            {VIDEO_FEEDS.map((feed) => (
              <div
                key={feed.id}
                style={{
                  flex: 1,
                  position: "relative",
                  borderBottom: "1px solid rgba(0, 229, 255, 0.08)",
                  background: "rgba(10, 10, 10, 0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <span style={{ position: "absolute", top: 4, left: 4, width: 12, height: 12, borderTop: "1px solid rgba(0, 229, 255, 0.3)", borderLeft: "1px solid rgba(0, 229, 255, 0.3)" }} />
                <span style={{ position: "absolute", top: 4, right: 4, width: 12, height: 12, borderTop: "1px solid rgba(0, 229, 255, 0.3)", borderRight: "1px solid rgba(0, 229, 255, 0.3)" }} />
                <span style={{ position: "absolute", bottom: 4, left: 4, width: 12, height: 12, borderBottom: "1px solid rgba(0, 229, 255, 0.3)", borderLeft: "1px solid rgba(0, 229, 255, 0.3)" }} />
                <span style={{ position: "absolute", bottom: 4, right: 4, width: 12, height: 12, borderBottom: "1px solid rgba(0, 229, 255, 0.3)", borderRight: "1px solid rgba(0, 229, 255, 0.3)" }} />

                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 10,
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    color: "rgba(0, 229, 255, 0.5)",
                  }}
                >
                  {feed.label}
                </div>

                {!feed.src && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1">
                      <rect x="2" y="3" width="20" height="18" rx="2" />
                      <line x1="2" y1="3" x2="22" y2="21" />
                    </svg>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 8, letterSpacing: "0.2em", color: "rgba(0, 229, 255, 0.15)" }}>
                      NO SIGNAL
                    </span>
                  </div>
                )}

                {feed.src && (
                  <video src={feed.src} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
