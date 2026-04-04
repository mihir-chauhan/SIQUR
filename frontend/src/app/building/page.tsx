"use client";

import { AnimatePresence, motion } from "framer-motion";
import BuildingView from "../../components/BuildingView";

export default function BuildingPage() {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="building-page"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <BuildingView />
      </motion.div>
    </AnimatePresence>
  );
}
