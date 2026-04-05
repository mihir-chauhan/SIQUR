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
  const annotateWaypointsRef = useRef<Array<{ x: number; y: number; z: number; t: number }>>([]);
  const [annotateCount, setAnnotateCount] = useState(0);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const globalTimeRef = useRef(0);

  // Sync all videos to global time
  const syncVideosToGlobalTime = (gt: number) => {
    const videos = document.querySelectorAll<HTMLVideoElement>("[data-watchman-video]");
    videos.forEach((v, i) => {
      const feed = VIDEO_FEEDS[i];
      if (!feed || !feed.src) return;
      const localT = gt - feed.offset;
      if (localT < 0 || localT > (v.duration || 999)) {
        // Outside this video's range — show black frame
        v.currentTime = localT < 0 ? 0 : v.duration || 0;
      } else {
        v.currentTime = localT;
      }
    });
  };

  // DEV: Keyboard controls for annotation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!annotateMode) return;

      // Space = record waypoint at current global time
      if (e.code === "Space") {
        e.preventDefault();
        const d = camDataRef.current;
        const gt = +globalTimeRef.current.toFixed(2);
        const pt = { x: +d.x.toFixed(2), y: +d.y.toFixed(2), z: +d.z.toFixed(2), t: gt };
        annotateWaypointsRef.current.push(pt);
        // Sort by time so waypoints stay ordered
        annotateWaypointsRef.current.sort((a, b) => a.t - b.t);
        setAnnotateCount(annotateWaypointsRef.current.length);
        console.log(`[WAYPOINT ${annotateWaypointsRef.current.length}] globalT=${gt}s`, JSON.stringify(pt));
        console.log("ALL WAYPOINTS:", JSON.stringify(annotateWaypointsRef.current, null, 2));
      }
      // Arrow keys = scrub global timeline
      if (e.code === "ArrowRight") {
        e.preventDefault();
        const newT = Math.max(0, globalTimeRef.current + 0.5);
        globalTimeRef.current = newT;
        setGlobalTime(newT);
        syncVideosToGlobalTime(newT);
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        const newT = Math.max(0, globalTimeRef.current - 0.5);
        globalTimeRef.current = newT;
        setGlobalTime(newT);
        syncVideosToGlobalTime(newT);
      }
      // Z = undo last waypoint
      if (e.code === "KeyZ" && annotateWaypointsRef.current.length > 0) {
        const removed = annotateWaypointsRef.current.pop();
        setAnnotateCount(annotateWaypointsRef.current.length);
        console.log("[UNDO]", JSON.stringify(removed));
        console.log("ALL WAYPOINTS:", JSON.stringify(annotateWaypointsRef.current, null, 2));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotateMode]);

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

        // --- Multi-person animated paths ---
        const PATHS = [
          {
            id: "person1",
            color: [0.1, 0.3, 1.0] as [number, number, number],
            dotColors: ["rgba(60, 100, 255, 0.9)", "rgba(40, 80, 220, 0.3)", "rgba(30, 60, 200, 0)"],
            waypoints: [
              {x:-7.82, y:0.79, z:17.72, t:0},
              {x:-7.78, y:0.78, z:17.94, t:3},
              {x:-7.76, y:0.79, z:18.15, t:6},
              {x:-7.76, y:0.79, z:18.15, t:8},
              {x:-7.83, y:0.82, z:17.8,  t:8.5},
              {x:-7.94, y:0.83, z:16.71, t:9.5},
              {x:-7.94, y:0.80, z:16.35, t:10},
              {x:-7.76, y:0.85, z:16.04, t:11},
              {x:-6.93, y:0.87, z:15.85, t:12},
              {x:-5.39, y:0.77, z:15.73, t:13},
              {x:-3.43, y:0.63, z:15.63, t:14},
              {x:-2.15, y:0.64, z:15.80, t:15},
              {x:-0.89, y:0.66, z:16.19, t:15.5},
              {x:-0.37, y:0.70, z:16.99, t:16},
            ],
          },
          {
            id: "person2",
            color: [1.0, 0.85, 0.1] as [number, number, number],
            dotColors: ["rgba(255, 220, 40, 0.9)", "rgba(220, 180, 30, 0.3)", "rgba(200, 160, 20, 0)"],
            waypoints: [
              {x:-7.56, y:0.81, z:19.6,  t:4.5},
              {x:-7.81, y:0.78, z:19.11, t:5.5},
              {x:-7.84, y:0.77, z:18.94, t:6},
              {x:-7.87, y:0.77, z:18.71, t:6.5},
              {x:-7.86, y:0.79, z:18.55, t:7},
              {x:-7.89, y:0.81, z:17.77, t:8},
              {x:-7.87, y:0.84, z:17.1,  t:8.5},
              {x:-7.83, y:0.83, z:16.52, t:9},
              {x:-7.72, y:0.80, z:16.07, t:9.5},
              {x:-7.10, y:0.82, z:15.92, t:10},
              {x:-6.28, y:0.80, z:15.91, t:10.5},
              {x:-5.67, y:0.78, z:15.87, t:11},
              {x:-4.66, y:0.70, z:15.83, t:11.5},
              {x:-3.32, y:0.55, z:15.78, t:12},
              {x:-2.73, y:0.53, z:15.80, t:12.5},
              {x:-1.92, y:0.61, z:16.07, t:13},
              {x:-1.07, y:0.67, z:16.40, t:13.5},
              {x:-0.42, y:0.69, z:16.92, t:14},
              {x:-0.14, y:0.71, z:17.49, t:14.5},
              {x:0.11,  y:0.73, z:18.21, t:15},
              {x:0.34,  y:0.73, z:18.95, t:16},
            ],
          },
          {
            id: "person3",
            color: [0.0, 0.9, 1.0] as [number, number, number],
            dotColors: ["rgba(0, 229, 255, 0.9)", "rgba(0, 200, 230, 0.3)", "rgba(0, 180, 210, 0)"],
            waypoints: [
              {x:-0.21, y:0.45, z:14.81, t:0},
              {x:-0.21, y:0.45, z:14.81, t:6},
              {x:-0.21, y:0.45, z:14.81, t:8},
              {x:-0.15, y:0.48, z:14.89, t:9},
              {x:-0.16, y:0.52, z:15.16, t:9.5},
              {x:-0.20, y:0.53, z:15.40, t:10},
              {x:-0.51, y:0.57, z:15.53, t:10.5},
              {x:-1.25, y:0.57, z:15.55, t:11},
              {x:-1.64, y:0.58, z:15.65, t:11.5},
              {x:-2.20, y:0.53, z:15.65, t:12},
              {x:-2.42, y:0.54, z:15.61, t:12.5},
              {x:-2.31, y:0.55, z:15.67, t:13},
              {x:-1.92, y:0.57, z:15.92, t:14},
              {x:-1.13, y:0.63, z:16.37, t:14.5},
              {x:-0.48, y:0.63, z:16.93, t:15},
              {x:-0.37, y:0.64, z:17.46, t:15.5},
              {x:-0.20, y:0.66, z:17.89, t:16},
            ],
          },
        ];

        // Build all path animations
        const SAMPLE_COUNT = 500;
        const allAnims: Array<{
          dot: THREE.Sprite;
          lineGeo: LineGeometry;
          lineMat: LineMaterial;
          sampledPoints: number[];
          totalSegments: number;
          waypoints: Array<{x:number;y:number;z:number;t:number}>;
          totalDuration: number;
        }> = [];

        for (const path of PATHS) {
          if (path.waypoints.length < 2) continue;

          const curvePoints = path.waypoints.map(w => new THREE.Vector3(w.x, w.y, w.z));
          const curve = new THREE.CatmullRomCurve3(curvePoints, false, "catmullrom", 0.5);

          const sampledPoints: number[] = [];
          const sampledColors: number[] = [];
          for (let i = 0; i < SAMPLE_COUNT; i++) {
            const t = i / (SAMPLE_COUNT - 1);
            const p = curve.getPoint(t);
            sampledPoints.push(p.x, p.y, p.z);
            const brightness = 0.4 + 0.4 * t;
            sampledColors.push(
              brightness * path.color[0],
              brightness * path.color[1],
              brightness * path.color[2]
            );
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

          const trailLine = new Line2(lineGeo, lineMat);
          trailLine.computeLineDistances();
          // @ts-ignore
          lineGeo.instanceCount = 0;
          scene.add(trailLine);

          // Dot sprite
          const glowCanvas = document.createElement("canvas");
          glowCanvas.width = 64;
          glowCanvas.height = 64;
          const glowCtx = glowCanvas.getContext("2d")!;
          const gradient = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
          gradient.addColorStop(0, path.dotColors[0]);
          gradient.addColorStop(0.3, path.dotColors[1]);
          gradient.addColorStop(1, path.dotColors[2]);
          glowCtx.fillStyle = gradient;
          glowCtx.fillRect(0, 0, 64, 64);

          const dot = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: new THREE.CanvasTexture(glowCanvas),
              blending: THREE.NormalBlending,
              transparent: true,
              depthTest: false,
            })
          );
          dot.scale.set(0.2, 0.2, 1);
          dot.visible = false;
          scene.add(dot);

          allAnims.push({
            dot,
            lineGeo,
            lineMat,
            sampledPoints,
            totalSegments: SAMPLE_COUNT - 1,
            waypoints: path.waypoints,
            totalDuration: path.waypoints[path.waypoints.length - 1].t,
          });
        }

        // Store all line materials for resize updates
        lineMatRef = allAnims.length > 0 ? allAnims[0].lineMat : null;
        const allLineMats = allAnims.map(a => a.lineMat);

        // Global animation state
        const globalMaxDuration = Math.max(...allAnims.map(a => a.totalDuration));
        const animState = {
          paths: allAnims,
          totalDuration: globalMaxDuration,
          elapsed: 0,
          allLineMats,
        };
        (scene as unknown as { _pathAnim: typeof animState })._pathAnim = animState;
        pathAnimRef.current = animState as unknown as typeof pathAnimRef.current;

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
      const animForResize = (scene as unknown as { _pathAnim?: { allLineMats: LineMaterial[] } })._pathAnim;
      if (animForResize) animForResize.allLineMats.forEach(m => m.resolution.set(w, h));
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

      // Animate all paths — time-based interpolation + Line2 progressive reveal
      const anim = (scene as unknown as { _pathAnim?: { paths: Array<{ dot: THREE.Sprite; lineGeo: LineGeometry; sampledPoints: number[]; totalSegments: number; waypoints: Array<{x:number;y:number;z:number;t:number}>; totalDuration: number }>; totalDuration: number; elapsed: number } })._pathAnim;
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
            if (anim.elapsed >= feed.offset && !v.ended) {
              allVideosFinished = false;
            }
          }
        });
        const allPathsDone = anim.paths.every(p => anim.elapsed >= p.totalDuration);

        if (allPathsDone && allVideosFinished) {
          pathPlayingRef.current = false;
          pathFinishedRef.current = true;
          setPathPlaying(false);
        }

        // Animate each person's path
        for (const p of anim.paths) {
          const dotElapsed = Math.min(anim.elapsed, p.totalDuration);

          // Lerp between waypoints
          const wps = p.waypoints;
          let wpIdx = 0;
          for (let i = 0; i < wps.length - 1; i++) {
            if (dotElapsed >= wps[i].t) wpIdx = i;
          }
          const wpA = wps[wpIdx];
          const wpB = wps[Math.min(wpIdx + 1, wps.length - 1)];
          const segDur = wpB.t - wpA.t;
          const lerpT = segDur > 0 ? Math.min((dotElapsed - wpA.t) / segDur, 1) : 1;

          const px = wpA.x + (wpB.x - wpA.x) * lerpT;
          const py = wpA.y + (wpB.y - wpA.y) * lerpT;
          const pz = wpA.z + (wpB.z - wpA.z) * lerpT;

          // Only show dot if we've reached this person's start time
          if (anim.elapsed >= wps[0].t) {
            p.dot.visible = true;
            p.dot.position.set(px, py, pz);
          }

          // Reveal trail by closest point to dot
          let closestSeg = 0;
          let closestDist = Infinity;
          for (let s = 0; s <= p.totalSegments; s++) {
            const si = s * 3;
            const dx = p.sampledPoints[si] - px;
            const dy = p.sampledPoints[si + 1] - py;
            const dz = p.sampledPoints[si + 2] - pz;
            const dist = dx * dx + dy * dy + dz * dz;
            if (dist < closestDist) {
              closestDist = dist;
              closestSeg = s;
            }
          }
          // @ts-ignore
          p.lineGeo.instanceCount = closestSeg;
        }
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
              <span style={{ marginTop: 8, color: "#ffdd44", fontSize: 9 }}>WAYPOINTS: {annotateCount} [SPACE]</span>

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
                      (pathAnimRef.current as unknown as { elapsed: number }).elapsed = 0;
                      // Reset all paths
                      const paths = (pathAnimRef.current as unknown as { paths: Array<{ dot: THREE.Sprite; lineGeo: LineGeometry }> }).paths;
                      if (paths) {
                        for (const p of paths) {
                          // @ts-ignore
                          p.lineGeo.instanceCount = 0;
                          p.dot.visible = false;
                        }
                      }
                      pathFinishedRef.current = false;
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
                      (pathAnimRef.current as unknown as { elapsed: number }).elapsed = 0;
                      const paths = (pathAnimRef.current as unknown as { paths: Array<{ dot: THREE.Sprite; lineGeo: LineGeometry }> }).paths;
                      if (paths) {
                        for (const p of paths) {
                          // @ts-ignore
                          p.lineGeo.instanceCount = 0;
                          p.dot.visible = false;
                        }
                      }
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

          {/* Right: Video feeds (30%) or Annotate mode */}
          <div
            style={{
              width: "30%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid rgba(0, 229, 255, 0.1)",
            }}
          >
            {/* Annotate toggle — top of right panel */}
            {!annotateMode && (
              <button
                onClick={() => {
                  setAnnotateMode(true);
                  setGlobalTime(0);
                  globalTimeRef.current = 0;
                  annotateWaypointsRef.current = [];
                  setAnnotateCount(0);
                  document.querySelectorAll<HTMLVideoElement>("[data-watchman-video]").forEach((v) => {
                    v.pause();
                    v.currentTime = 0;
                  });
                }}
                style={{
                  width: "100%", padding: "6px",
                  fontFamily: "var(--font-mono, monospace)", fontSize: 8, letterSpacing: "0.2em",
                  color: "#ffdd44", background: "rgba(255,221,68,0.05)",
                  border: "none", borderBottom: "1px solid rgba(255,221,68,0.15)",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                ANNOTATE MODE
              </button>
            )}

            {/* Video stack — always visible, synced in annotate mode */}
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

            {/* Annotate mode: global timeline controls at bottom of video stack */}
            {annotateMode && (
              <div style={{
                padding: "10px 12px",
                borderTop: "1px solid rgba(255, 221, 68, 0.2)",
                background: "rgba(20, 18, 5, 0.9)",
              }}>
                <div style={{
                  fontFamily: "var(--font-mono, monospace)", fontSize: 14, fontWeight: 700,
                  color: "#ffdd44", marginBottom: 6,
                }}>
                  GLOBAL: {globalTime.toFixed(2)}s
                </div>
                <div style={{
                  fontFamily: "var(--font-mono, monospace)", fontSize: 8,
                  color: "rgba(255, 221, 68, 0.5)", letterSpacing: "0.1em", marginBottom: 4,
                }}>
                  {VIDEO_FEEDS.filter(f => f.src).map(f => {
                    const localT = globalTime - f.offset;
                    const active = localT >= 0;
                    return `${f.label}: ${active ? localT.toFixed(1) + "s" : "waiting"}`;
                  }).join("  |  ")}
                </div>
                <div style={{
                  fontFamily: "var(--font-mono, monospace)", fontSize: 7,
                  color: "rgba(0, 229, 255, 0.4)", letterSpacing: "0.1em", marginBottom: 6,
                }}>
                  LEFT/RIGHT = SCRUB 0.5s | SPACE = RECORD | Z = UNDO
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "#ffdd44" }}>
                    POINTS: {annotateCount}
                  </span>
                  <button
                    onClick={() => {
                      setAnnotateMode(false);
                      setGlobalTime(0);
                      globalTimeRef.current = 0;
                    }}
                    style={{
                      fontFamily: "var(--font-mono, monospace)", fontSize: 8, letterSpacing: "0.15em",
                      color: "#00e5ff", background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.2)",
                      borderRadius: 3, padding: "4px 10px", cursor: "pointer",
                    }}
                  >
                    EXIT ANNOTATE
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </motion.div>
  );
}
