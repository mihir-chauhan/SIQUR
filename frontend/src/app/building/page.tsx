"use client";

import { AnimatePresence } from "framer-motion";
import BuildingView from "../../components/BuildingView";

export default function BuildingPage() {
  return (
    <AnimatePresence mode="wait">
      <BuildingView key="building-view" />
    </AnimatePresence>
  );
}
