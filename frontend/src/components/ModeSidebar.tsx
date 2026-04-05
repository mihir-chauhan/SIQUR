"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

/**
 * ModeSidebar — thin left-edge bar (Discord-style server switcher).
 * Two modes: Placement (/building) and Watchman (/v2/watchman).
 * Active mode is highlighted. Clicking the other triggers navigation.
 */

interface ModeSidebarProps {
  onTransitionStart?: () => void;
}

export default function ModeSidebar({ onTransitionStart }: ModeSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isWatchman = pathname === "/v2/watchman";
  const isPlacement = !isWatchman;

  const handleSwitch = (target: "placement" | "watchman") => {
    if (target === "placement" && !isPlacement) {
      router.push("/building");
    } else if (target === "watchman" && !isWatchman) {
      if (onTransitionStart) onTransitionStart();
      // Small delay so transition animation shows before route change
      setTimeout(() => router.push("/v2/watchman"), 600);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: 48,
        zIndex: 25,
        backgroundColor: "rgba(6, 6, 6, 0.95)",
        borderRight: "1px solid rgba(0, 229, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 16,
        gap: 8,
      }}
    >
      {/* Placement mode icon */}
      <button
        onClick={() => handleSwitch("placement")}
        title="Camera Placement"
        style={{
          width: 36,
          height: 36,
          borderRadius: isPlacement ? 8 : 18,
          border: "none",
          background: isPlacement
            ? "rgba(0, 229, 255, 0.15)"
            : "rgba(255, 255, 255, 0.04)",
          cursor: isPlacement ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          position: "relative",
        }}
      >
        {/* Active indicator bar */}
        {isPlacement && (
          <div
            style={{
              position: "absolute",
              left: -10,
              width: 3,
              height: 20,
              borderRadius: 2,
              backgroundColor: "#00e5ff",
            }}
          />
        )}
        {/* Camera/grid icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isPlacement ? "#00e5ff" : "rgba(255,255,255,0.35)"} strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="18" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M2 8h20" />
        </svg>
      </button>

      {/* Divider */}
      <div style={{ width: 20, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />

      {/* Watchman mode icon */}
      <button
        onClick={() => handleSwitch("watchman")}
        title="Watchman"
        style={{
          width: 36,
          height: 36,
          borderRadius: isWatchman ? 8 : 18,
          border: "none",
          background: isWatchman
            ? "rgba(16, 185, 129, 0.15)"
            : "rgba(255, 255, 255, 0.04)",
          cursor: isWatchman ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          position: "relative",
        }}
      >
        {/* Active indicator bar */}
        {isWatchman && (
          <div
            style={{
              position: "absolute",
              left: -10,
              width: 3,
              height: 20,
              borderRadius: 2,
              backgroundColor: "#10b981",
            }}
          />
        )}
        {/* Eye/path icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isWatchman ? "#10b981" : "rgba(255,255,255,0.35)"} strokeWidth="1.5">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );
}
