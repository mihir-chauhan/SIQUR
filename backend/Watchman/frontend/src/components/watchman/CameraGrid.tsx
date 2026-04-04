"use client";

import type { WatchmanCamera } from "@/lib/watchman-types";
import CameraTile from "./CameraTile";

interface CameraGridProps {
  cameras: WatchmanCamera[];
}

export default function CameraGrid({ cameras }: CameraGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(2, 1fr)",
        gap: 8,
        height: "100%",
      }}
    >
      {cameras.map((cam) => (
        <CameraTile key={cam.id} camera={cam} />
      ))}

      {/* Empty slot placeholders while loading */}
      {cameras.length === 0 &&
        Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--color-surface)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              aria-hidden
              style={{ width: 40, height: 40, color: "rgba(255,255,255,0.06)" }}
            >
              <path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1" />
              <rect x="3" y="7" width="12" height="10" rx="2" />
              <circle cx="10" cy="12" r="2" />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--color-text-dim)",
                letterSpacing: "0.08em",
              }}
            >
              NO SIGNAL
            </span>
          </div>
        ))}
    </div>
  );
}
