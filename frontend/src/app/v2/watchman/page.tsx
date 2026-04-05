"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ModeSidebar from "@/components/ModeSidebar";

/**
 * Watchman — real-time person tracking and path visualization.
 * Renders the OBJ interior with motion paths overlaid.
 * This is a placeholder skeleton; actual tracking implementation TBD.
 */
export default function WatchmanPage() {
  const [ready, setReady] = useState(false);

  // Brief loading state on mount
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(timer);
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
      {/* Mode switcher (far left) */}
      <ModeSidebar />

      {/* Loading state */}
      {!ready && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 48,
            right: 0,
            bottom: 0,
            zIndex: 50,
            background: "#000",
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
              border: "2px solid rgba(16, 185, 129, 0.15)",
              borderTopColor: "rgba(16, 185, 129, 0.8)",
              animation: "wm-spin 1s linear infinite",
              marginBottom: 20,
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "#10b981",
              textShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
            }}
          >
            INITIALIZING WATCHMAN
          </div>
          <style>{`
            @keyframes wm-spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {/* Watchman workspace */}
      {ready && (
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
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: "1px solid rgba(16, 185, 129, 0.1)",
              background: "rgba(6, 6, 6, 0.9)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                letterSpacing: "0.3em",
                color: "#10b981",
              }}
            >
              WATCHMAN // MOTION TRACKING // HALL OF DATA SCIENCE AND AI
            </span>
          </div>

          {/* Main viewport — placeholder for OBJ interior + path rendering */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Grid background */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.04,
                backgroundImage:
                  "linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            <div
              style={{
                textAlign: "center",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 14,
                  letterSpacing: "0.2em",
                  color: "rgba(16, 185, 129, 0.6)",
                  marginBottom: 8,
                }}
              >
                WATCHMAN ACTIVE
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  color: "rgba(16, 185, 129, 0.3)",
                }}
              >
                AWAITING TRACKING DATA
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
