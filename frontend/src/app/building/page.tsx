"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import BuildingView from "../../components/BuildingView";

const SceneView = dynamic(() => import("../../components/SceneView"), {
  ssr: false,
});

export default function BuildingPage() {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="building-page"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        {/* 3D scene fills entire viewport */}
        <SceneView
          splatPath="/splats/elliott.spz"
          objPath="/models/interior/4_4_2026.obj"
          mtlPath="/models/interior/4_4_2026.mtl"
        />

        {/* Existing BuildingView UI overlaid on top */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            width: "420px",
            maxHeight: "calc(100vh - 32px)",
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
