"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const GlobeView = dynamic(() => import("@/components/GlobeView"), {
  ssr: false,
});

export default function Home() {
  return (
    <motion.main
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex-1 w-full h-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <GlobeView />
    </motion.main>
  );
}
