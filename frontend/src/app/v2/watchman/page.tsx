"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ModeSidebar from "@/components/ModeSidebar";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

/**
 * Watchman — synchronized motion tracking viewer.
 * Left: OBJ interior with standalone Three.js (no GaussianSplats3D, normal Y-up).
 * Right: 4 stacked video feeds (placeholder until videos provided).
 */

const VIDEO_FEEDS = [
  { id: "cam_h1", label: "CAM-H1", src: "/watchman-footage/cam1_mask.mp4", offset: 0 },
  { id: "cam_h2", label: "CAM-H2", src: "/watchman-footage/cam2_mask.mp4", offset: 7 },
  { id: "cam_h3", label: "CAM-H3", src: "/watchman-footage/cam3_mask.mp4", offset: 6 },
  { id: "cam_h4", label: "CAM-H4", src: "", offset: 0 },
];

export default function WatchmanPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [objReady, setObjReady] = useState(false);
  const [camData, setCamData] = useState({ x: 0, y: 0, z: 0, yaw: 0 });
  const camDataRef = useRef(camData);
  const [pathPlaying, setPathPlaying] = useState(false);
  const pathPlayingRef = useRef(false);
  const pathFinishedRef = useRef(false);
  const [envOpacity, setEnvOpacity] = useState(1.0);
  const objWrapperRef = useRef<THREE.Group | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null, null]);
  const pathAnimRef = useRef<{ elapsed: number; lineGeo: unknown; dot: THREE.Sprite | THREE.Object3D; totalDuration: number; totalSegments: number; waypoints: Array<{x:number;y:number;z:number;t:number}>; sampledPoints: number[] } | null>(null);
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


  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let destroyed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    let lineMatRef: LineMaterial | null = null;

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

        // --- Animated path (t = timestamp in seconds) ---
        const WAYPOINTS = [
          {x:-7.53,y:0.76,z:19.53,t:0.0},{x:-7.75,y:0.77,z:19.4,t:0.2},
          {x:-7.85,y:0.75,z:19.18,t:0.4},{x:-7.87,y:0.75,z:18.95,t:0.6},
          {x:-7.88,y:0.74,z:18.77,t:0.8},{x:-7.88,y:0.74,z:18.46,t:1.0},
          {x:-7.9,y:0.75,z:18.34,t:1.2},{x:-7.9,y:0.75,z:18.2,t:1.4},
          {x:-7.89,y:0.76,z:18.01,t:1.6},{x:-7.89,y:0.77,z:17.85,t:1.8},
          {x:-7.89,y:0.77,z:17.66,t:2.0},{x:-7.88,y:0.77,z:17.41,t:2.2},
          {x:-7.87,y:0.77,z:17.22,t:2.4},{x:-7.86,y:0.77,z:17.02,t:2.6},
          {x:-7.85,y:0.76,z:16.81,t:2.8},{x:-7.84,y:0.76,z:16.59,t:3.0},
          {x:-7.82,y:0.75,z:16.48,t:3.2},{x:-7.8,y:0.75,z:16.36,t:3.4},
          {x:-7.79,y:0.74,z:16.25,t:3.6},{x:-7.76,y:0.72,z:16.09,t:3.8},
          {x:-7.72,y:0.72,z:16.06,t:4.0},{x:-7.63,y:0.74,z:16,t:4.2},
          {x:-7.48,y:0.77,z:15.95,t:4.4},{x:-7.37,y:0.78,z:15.93,t:4.6},
          {x:-7.15,y:0.8,z:15.88,t:4.8},{x:-6.73,y:0.83,z:15.82,t:5.0},
          {x:-6.53,y:0.81,z:15.79,t:5.2},{x:-6.32,y:0.78,z:15.75,t:5.4},
          {x:-6.08,y:0.77,z:15.73,t:5.6},{x:-5.84,y:0.75,z:15.78,t:5.8},
          {x:-5.49,y:0.76,z:15.81,t:6.0},{x:-4.91,y:0.74,z:15.82,t:6.2},
          {x:-4.6,y:0.67,z:15.84,t:6.4},{x:-4.27,y:0.69,z:15.8,t:6.6},
          {x:-4.03,y:0.65,z:15.79,t:6.8},{x:-3.87,y:0.63,z:15.8,t:7.0},
          {x:-3.44,y:0.6,z:15.69,t:7.2},{x:-2.97,y:0.52,z:15.77,t:7.4},
          {x:-2.75,y:0.49,z:15.75,t:7.6},{x:-2.37,y:0.52,z:15.76,t:7.8},
          {x:-2.02,y:0.54,z:15.75,t:8.0},{x:-1.8,y:0.55,z:15.8,t:8.2},
          {x:-1.26,y:0.61,z:15.93,t:8.4},{x:-0.79,y:0.62,z:16.24,t:8.6},
          {x:-0.44,y:0.59,z:16.65,t:8.8},{x:-0.28,y:0.58,z:17.22,t:9.0},
          {x:-0.19,y:0.6,z:17.57,t:9.2},{x:-0.13,y:0.6,z:18.2,t:9.4},
          {x:0,y:0.6,z:18.52,t:9.6},{x:0.16,y:0.59,z:18.97,t:9.8},
        ];
        const totalDuration = WAYPOINTS[WAYPOINTS.length - 1].t;

        // --- Line2 trail + Sprite glow dot ---
        const curvePoints = WAYPOINTS.map(w => new THREE.Vector3(w.x, w.y, w.z));
        const curve = new THREE.CatmullRomCurve3(curvePoints, false, "catmullrom", 0.5);

        // Sample the curve into dense points for smooth line
        const SAMPLE_COUNT = 500;
        const sampledPoints: number[] = [];
        const sampledColors: number[] = [];
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const t = i / (SAMPLE_COUNT - 1);
          const p = curve.getPoint(t);
          sampledPoints.push(p.x, p.y, p.z);
          // Subtle gradient: muted cyan at tail -> slightly brighter at head
          const brightness = 0.4 + 0.4 * t;
          sampledColors.push(brightness * 0.2, brightness * 0.6, brightness * 0.7);
        }

        const lineGeo = new LineGeometry();
        lineGeo.setPositions(sampledPoints);
        lineGeo.setColors(sampledColors);

        const lineMat = new LineMaterial({
          linewidth: 2,
          vertexColors: true,
          transparent: true,
          opacity: 0.7,
          resolution: new THREE.Vector2(container.clientWidth, container.clientHeight),
        });

        lineMatRef = lineMat;
        const trailLine = new Line2(lineGeo, lineMat);
        trailLine.computeLineDistances();
        // @ts-ignore — instanceCount is the Line2 progressive reveal mechanism
        lineGeo.instanceCount = 0;
        scene.add(trailLine);

        // Glowing sprite dot
        const glowCanvas = document.createElement("canvas");
        glowCanvas.width = 64;
        glowCanvas.height = 64;
        const glowCtx = glowCanvas.getContext("2d")!;
        const gradient = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(0, 229, 255, 0.9)");
        gradient.addColorStop(0.3, "rgba(0, 200, 230, 0.3)");
        gradient.addColorStop(1, "rgba(0, 229, 255, 0)");
        glowCtx.fillStyle = gradient;
        glowCtx.fillRect(0, 0, 64, 64);
        const glowTexture = new THREE.CanvasTexture(glowCanvas);

        const dot = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture,
            blending: THREE.NormalBlending,
            transparent: true,
            depthTest: false,
          })
        );
        dot.scale.set(0.2, 0.2, 1);
        dot.visible = false; // hidden until animation starts
        scene.add(dot);

        // Animation state — time-based
        const animState = {
          dot,
          lineGeo,
          sampledPoints,
          totalSegments: SAMPLE_COUNT - 1,
          waypoints: WAYPOINTS,
          totalDuration,
          elapsed: 0,
        };
        (scene as unknown as { _pathAnim: typeof animState })._pathAnim = animState;
        pathAnimRef.current = animState;

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
      if (lineMatRef) lineMatRef.resolution.set(w, h);
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

      // Animate path — time-based interpolation + Line2 progressive reveal
      const anim = (scene as unknown as { _pathAnim?: typeof pathAnimRef.current })._pathAnim;
      if (anim && pathPlayingRef.current) {
        anim.elapsed += delta;

        // Start videos when their offset is reached (but not if already ended)
        const videos = document.querySelectorAll<HTMLVideoElement>("[data-watchman-video]");
        videos.forEach((v, vi) => {
          const feed = VIDEO_FEEDS[vi];
          if (feed && feed.src && anim.elapsed >= feed.offset && v.paused && !v.ended) {
            v.play();
          }
        });

        // Check if all started videos have ended
        let allVideosFinished = true;
        videos.forEach((v, vi) => {
          const feed = VIDEO_FEEDS[vi];
          if (feed && feed.src) {
            // Only check videos whose offset has been reached
            if (anim.elapsed >= feed.offset && !v.ended) {
              allVideosFinished = false;
            }
          }
        });
        const dotDone = anim.elapsed >= anim.totalDuration;

        // Stop when all started videos have ended AND dot is done
        if (dotDone && allVideosFinished) {
          pathPlayingRef.current = false;
          pathFinishedRef.current = true;
          setPathPlaying(false);
        }

        // Clamp dot animation to its own duration (but keep elapsed running for videos)
        const dotElapsed = Math.min(anim.elapsed, anim.totalDuration);

        // Find which two waypoints bracket the current time and lerp
        const wps = anim.waypoints;
        let wpIdx = 0;
        for (let i = 0; i < wps.length - 1; i++) {
          if (dotElapsed >= wps[i].t) wpIdx = i;
        }
        const wpA = wps[wpIdx];
        const wpB = wps[Math.min(wpIdx + 1, wps.length - 1)];
        const segDuration = wpB.t - wpA.t;
        const lerpT = segDuration > 0 ? Math.min((dotElapsed - wpA.t) / segDuration, 1) : 1;

        // Interpolated position
        const px = wpA.x + (wpB.x - wpA.x) * lerpT;
        const py = wpA.y + (wpB.y - wpA.y) * lerpT;
        const pz = wpA.z + (wpB.z - wpA.z) * lerpT;

        anim.dot.visible = true;
        anim.dot.position.set(px, py, pz);

        // Reveal trail: map elapsed time to segment count
        const progress = dotElapsed / anim.totalDuration;
        const seg = Math.floor(progress * anim.totalSegments);
        // @ts-ignore — instanceCount controls Line2 progressive reveal
        anim.lineGeo.instanceCount = seg;
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


              <div style={{ display: "flex", gap: 6, marginTop: 8, pointerEvents: "auto" }}>
                <button
                  onClick={() => {
                    if (pathFinishedRef.current && pathAnimRef.current) {
                      pathAnimRef.current.elapsed = 0;
                      // @ts-ignore
                      pathAnimRef.current.lineGeo.instanceCount = 0;
                      (pathAnimRef.current.dot as THREE.Sprite).visible = false;
                      pathFinishedRef.current = false;
                      // Reset videos to start
                      document.querySelectorAll<HTMLVideoElement>("[data-watchman-video]").forEach((v) => { v.currentTime = 0; });
                    }
                    pathPlayingRef.current = true;
                    setPathPlaying(true);
                    // Videos are started by the animate loop based on offsets
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
                    // Pause all videos
                    document.querySelectorAll<HTMLVideoElement>("[data-watchman-video]").forEach((v) => v.pause());
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
                <button
                  onClick={() => {
                    // Full restart — like reloading the page
                    pathPlayingRef.current = false;
                    pathFinishedRef.current = false;
                    setPathPlaying(false);
                    if (pathAnimRef.current) {
                      pathAnimRef.current.elapsed = 0;
                      // @ts-ignore
                      pathAnimRef.current.lineGeo.instanceCount = 0;
                      (pathAnimRef.current.dot as THREE.Sprite).visible = false;
                    }
                    document.querySelectorAll<HTMLVideoElement>("[data-watchman-video]").forEach((v) => {
                      v.pause();
                      v.currentTime = 0;
                    });
                  }}
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: "#ffdd44",
                    background: "rgba(255, 221, 68, 0.1)",
                    border: "1px solid rgba(255, 221, 68, 0.3)",
                    borderRadius: 3,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  RESTART
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
            {VIDEO_FEEDS.map((feed, feedIdx) => (
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
                  <video
                    data-watchman-video
                    ref={(el) => { videoRefs.current[feedIdx] = el; }}
                    src={feed.src}
                    muted
                    playsInline
                    preload="auto"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
