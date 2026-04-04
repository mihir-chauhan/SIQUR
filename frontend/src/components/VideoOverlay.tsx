"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoOverlayProps {
  videoUrl: string;
  onClose: () => void;
}

export default function VideoOverlay({ videoUrl, onClose }: VideoOverlayProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      <motion.div
        ref={backdropRef}
        onClick={handleBackdropClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0, 0, 0, 0.92)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          style={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.3em",
            color: "var(--color-accent-cyan)",
          }}
          className="glow-cyan"
        >
          SIMULATION PLAYBACK
        </motion.div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close simulation playback"
          style={{
            position: "absolute",
            top: 20,
            right: 24,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(0, 229, 255, 0.2)",
            borderRadius: 3,
            padding: "6px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.15em",
            color: "var(--color-accent-cyan)",
            cursor: "pointer",
            zIndex: 101,
            transition: "background var(--duration-fast) ease",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.background =
              "rgba(255, 255, 255, 0.1)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background =
              "rgba(255, 255, 255, 0.05)";
          }}
        >
          CLOSE [ESC]
        </button>

        {/* Video container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "relative",
            maxWidth: "85vw",
            maxHeight: "75vh",
            border: "1px solid rgba(0, 229, 255, 0.2)",
            borderRadius: 4,
            overflow: "hidden",
            background: "#000",
          }}
          className="glow-cyan-box"
        >
          <video
            src={videoUrl}
            autoPlay
            controls
            style={{
              display: "block",
              maxWidth: "85vw",
              maxHeight: "75vh",
              objectFit: "contain",
            }}
          />
        </motion.div>

        {/* Bottom hint */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--color-text-dim)",
          }}
        >
          CLICK OUTSIDE OR PRESS ESC TO CLOSE
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
