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

      const camera = new THREE.PerspectiveCamera(70, width / height, 1, 1000);
      camera.position.y = 150;
      camera.position.z = 500;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0, 0, 0);

      const light1 = new THREE.PointLight(0xffffff, 3, 0, 0);
      light1.position.set(500, 500, 500);
      scene.add(light1);

      const light2 = new THREE.PointLight(0xffffff, 1, 0, 0);
      light2.position.set(-500, -500, -500);
      scene.add(light2);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(200, 20, 10),
        new THREE.MeshPhongMaterial({ flatShading: true })
      );
      scene.add(sphere);

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400),
        new THREE.MeshBasicMaterial({ color: 0xe0e0e0 })
      );
      plane.position.y = -200;
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);

      const webglRenderer = new THREE.WebGLRenderer();
      webglRenderer.setSize(width, height);
      renderer = webglRenderer;

      const effect = new AsciiEffect(webglRenderer, " .:-+*=%@#", { invert: true });
      effect.setSize(width, height);
      effect.domElement.style.color = "white";
      effect.domElement.style.backgroundColor = "black";
      effect.domElement.style.position = "absolute";
      effect.domElement.style.inset = "0";
      effect.domElement.style.overflow = "hidden";
      effect.domElement.style.margin = "0";
      effect.domElement.style.padding = "0";
      effect.domElement.style.lineHeight = "1";

      if (disposedRef.current) {
        webglRenderer.dispose();
        return;
      }

      container.appendChild(effect.domElement);
      effectDom = effect.domElement;

      const start = Date.now();

      const animate = () => {
        if (disposedRef.current) return;
        animationId = requestAnimationFrame(animate);

        const timer = Date.now() - start;
        sphere.position.y = Math.abs(Math.sin(timer * 0.002)) * 150;
        sphere.rotation.x = timer * 0.0003;
        sphere.rotation.z = timer * 0.0002;

        effect.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        if (!containerRef.current || disposedRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
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
        inset: 0,
        overflow: "hidden",
        background: "#000",
        zIndex: 0,
      }}
    />
  );
}
