"use client";

import { useState } from "react";

export interface Layer {
  id: string;
  name: string;
  type: "splat" | "obj" | "camera";
  visible: boolean;
}

interface LayersSidebarProps {
  layers: Layer[];
  selectedLayerId: string | null;
  onToggleVisibility: (id: string) => void;
  onSelectLayer: (id: string) => void;
}

export default function LayersSidebar({
  layers,
  selectedLayerId,
  onToggleVisibility,
  onSelectLayer,
}: LayersSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 20,
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "10px",
            letterSpacing: "0.2em",
            color: "var(--color-accent-cyan)",
            background: "rgba(10, 10, 10, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(0, 229, 255, 0.2)",
            borderRadius: "4px",
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          LAYERS &gt;
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        width: "220px",
        zIndex: 20,
        backgroundColor: "rgba(10, 10, 10, 0.85)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(0, 229, 255, 0.15)",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px",
          borderBottom: "1px solid rgba(0, 229, 255, 0.1)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "9px",
            letterSpacing: "0.35em",
            color: "var(--color-accent-cyan)",
          }}
        >
          LAYERS
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "10px",
            color: "var(--color-text-dim)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
          }}
        >
          &lt;
        </button>
      </div>

      {/* Layer list */}
      <div style={{ padding: "6px 0" }}>
        {layers.map((layer) => {
          const isSelected = selectedLayerId === layer.id;
          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 14px",
                cursor: "pointer",
                backgroundColor: isSelected
                  ? "rgba(0, 229, 255, 0.08)"
                  : "transparent",
                borderLeft: isSelected
                  ? "2px solid var(--color-accent-cyan)"
                  : "2px solid transparent",
                transition: "all 0.1s ease",
              }}
            >
              {/* Visibility toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "14px",
                  color: layer.visible
                    ? "var(--color-accent-cyan)"
                    : "var(--color-text-dim)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  width: "20px",
                  opacity: layer.visible ? 1 : 0.4,
                }}
                title={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? "\u25C9" : "\u25CE"}
              </button>

              {/* Layer name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "11px",
                    color: isSelected
                      ? "var(--color-accent-cyan)"
                      : "var(--color-text)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {layer.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "8px",
                    color: "var(--color-text-dim)",
                    letterSpacing: "0.15em",
                    marginTop: "2px",
                  }}
                >
                  {layer.type === "splat"
                    ? "GAUSSIAN SPLAT"
                    : layer.type === "camera"
                      ? "CAMERA POINT"
                      : "OBJ MESH"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
