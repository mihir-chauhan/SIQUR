"use client";

import { useEffect, useRef } from "react";

export function AsciiSphere() {
  const containerRef = useRef<HTMLDivElement>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    disposedRef.current = false;

    let animationId: number;
    let renderer: { dispose: () => void; setSize: (w: number, h: number) => void } | null = null;
    let effectDom: HTMLElement | null = null;

    const init = async () => {
      const THREE = await import("three");
      const { AsciiEffect } = await import("three/examples/jsm/effects/AsciiEffect.js");

      if (disposedRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Pull camera back slightly to frame the larger sphere
      const camera = new THREE.PerspectiveCamera(58, width / height, 1, 2000);
      camera.position.y = 40;
      camera.position.z = 520;
      camera.lookAt(0, 0, 0);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0, 0, 0);

      const light1 = new THREE.PointLight(0xffffff, 3, 0, 0);
      light1.position.set(500, 500, 500);
      scene.add(light1);

      const light2 = new THREE.PointLight(0xffffff, 1, 0, 0);
      light2.position.set(-500, -500, -500);
      scene.add(light2);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
      scene.add(ambientLight);

      // Simple sphere — just spins
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(240, 64, 40),
        new THREE.MeshPhongMaterial({ flatShading: true })
      );
      scene.add(sphere);


      // Higher cap = more ASCII characters = more detail
      const effectW = Math.min(width,  1400);
      const effectH = Math.min(height,  900);

      const webglRenderer = new THREE.WebGLRenderer();
      webglRenderer.setSize(effectW, effectH);
      renderer = webglRenderer;

      const effect = new AsciiEffect(webglRenderer, " .:-+*=%@#", { invert: true });
      effect.setSize(effectW, effectH);
      effect.domElement.style.color = "white";
      effect.domElement.style.backgroundColor = "black";
      effect.domElement.style.overflow = "hidden";
      effect.domElement.style.margin = "0";
      effect.domElement.style.padding = "0";
      effect.domElement.style.lineHeight = "1";
      // Center the ASCII table within the container and fill any gaps with black
      effect.domElement.style.display = "flex";
      effect.domElement.style.alignItems = "center";
      effect.domElement.style.justifyContent = "center";
      effect.domElement.style.width = "100%";
      effect.domElement.style.height = "100%";

      if (disposedRef.current) {
        webglRenderer.dispose();
        return;
      }

      container.appendChild(effect.domElement);
      effectDom = effect.domElement;

      const start = Date.now();
      const TARGET_FPS = 15;
      const FRAME_MS   = 1000 / TARGET_FPS;
      let lastRender = 0;

      const animate = (timestamp: number) => {
        if (disposedRef.current) return;
        animationId = requestAnimationFrame(animate);

        // Skip frames to hold ~15fps — ASCII is decorative, not interactive
        if (timestamp - lastRender < FRAME_MS) return;
        lastRender = timestamp;

        // Pause when tab is not visible
        if (document.hidden) return;

        const timer = Date.now() - start;
        sphere.rotation.y = timer * 0.0003;

        effect.render(scene, camera);
      };

      animate(0);

      const handleResize = () => {
        if (!containerRef.current || disposedRef.current) return;
        const w = Math.min(containerRef.current.clientWidth,  1400);
        const h = Math.min(containerRef.current.clientHeight,  900);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        webglRenderer.setSize(w, h);
        effect.setSize(w, h);
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    };

    let cleanupResize: (() => void) | undefined;
    init().then((cleanup) => {
      cleanupResize = cleanup;
    });

    return () => {
      disposedRef.current = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) renderer.dispose();
      if (effectDom && containerRef.current?.contains(effectDom)) {
        containerRef.current.removeChild(effectDom);
      }
      cleanupResize?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        background: "#000",
        zIndex: 0,
      }}
    />
  );
}
