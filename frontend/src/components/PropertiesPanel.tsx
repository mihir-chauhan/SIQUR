"use client";

import { useRef, useCallback, useState } from "react";
import type { Layer } from "./LayersSidebar";

interface PropertiesPanelProps {
  layer: Layer | null;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  onPositionChange: (axis: "x" | "y" | "z", value: number) => void;
  onRotationChange: (axis: "x" | "y" | "z", value: number) => void;
  onScaleChange: (axis: "x" | "y" | "z", value: number) => void;
}

function DragInput({
  label,
  value,
  onChange,
  color,
  step = 0.05,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  step?: number;
}) {
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const startValue = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editing) return;
      isDragging.current = true;
      didDrag.current = false;
      startX.current = e.clientX;
      startValue.current = value;
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const dx = ev.clientX - startX.current;
        if (Math.abs(dx) > 2) didDrag.current = true;
        const newVal = startValue.current + dx * step;
        onChange(parseFloat(newVal.toFixed(2)));
      };

      const onUp = () => {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        // If no drag happened, enter edit mode
        if (!didDrag.current) {
          setEditText(value.toFixed(2));
          setEditing(true);
          setTimeout(() => inputRef.current?.select(), 0);
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [value, onChange, step, editing]
  );

  const commitEdit = useCallback(() => {
    const parsed = parseFloat(editText);
    if (!isNaN(parsed)) onChange(parseFloat(parsed.toFixed(2)));
    setEditing(false);
  }, [editText, onChange]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        cursor: editing ? "text" : "ew-resize",
        padding: "6px 8px",
        borderRadius: "3px",
        border: "1px solid rgba(0, 229, 255, 0.12)",
        background: "rgba(0, 229, 255, 0.03)",
        transition: "border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.12)";
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "11px",
          fontWeight: 700,
          color,
          width: "14px",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "12px",
            color: "var(--color-accent-cyan)",
            background: "rgba(0, 229, 255, 0.08)",
            border: "1px solid rgba(0, 229, 255, 0.4)",
            borderRadius: "2px",
            padding: "2px 4px",
            outline: "none",
            textAlign: "right",
            width: "100%",
          }}
          autoFocus
        />
      ) : (
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "12px",
            color: "var(--color-text)",
            textAlign: "right",
          }}
        >
          {value.toFixed(2)}
        </span>
      )}
    </div>
  );
}

export default function PropertiesPanel({
  layer,
  position,
  rotation,
  scale,
  onPositionChange,
  onRotationChange,
  onScaleChange,
}: PropertiesPanelProps) {
  if (!layer) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "10px",
          color: "var(--color-text-dim)",
          letterSpacing: "0.15em",
          padding: "16px",
          textAlign: "center",
        }}
      >
        SELECT A LAYER TO VIEW PROPERTIES
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Layer name header */}
      <div
        style={{
          borderBottom: "1px solid rgba(0, 229, 255, 0.1)",
          paddingBottom: "10px",
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
          PROPERTIES
        </span>
        <p
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "13px",
            color: "var(--color-text)",
            marginTop: "6px",
            letterSpacing: "0.05em",
          }}
        >
          {layer.name}
        </p>
        <p
          style={{
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
        </p>
      </div>

      {/* Position — drag to adjust */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "var(--color-text-dim)",
            marginBottom: "2px",
          }}
        >
          POSITION — DRAG TO ADJUST
        </span>
        <DragInput
          label="X"
          value={position.x}
          onChange={(v) => onPositionChange("x", v)}
          color="#ff4444"
        />
        <DragInput
          label="Y"
          value={position.y}
          onChange={(v) => onPositionChange("y", v)}
          color="#44ff44"
        />
        <DragInput
          label="Z"
          value={position.z}
          onChange={(v) => onPositionChange("z", v)}
          color="#4488ff"
        />
      </div>

      {/* Rotation */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "var(--color-text-dim)",
            marginBottom: "2px",
          }}
        >
          ROTATION (DEG) — DRAG TO ADJUST
        </span>
        <DragInput
          label="X"
          value={rotation.x}
          onChange={(v) => onRotationChange("x", v)}
          color="#ff4444"
          step={0.5}
        />
        <DragInput
          label="Y"
          value={rotation.y}
          onChange={(v) => onRotationChange("y", v)}
          color="#44ff44"
          step={0.5}
        />
        <DragInput
          label="Z"
          value={rotation.z}
          onChange={(v) => onRotationChange("z", v)}
          color="#4488ff"
          step={0.5}
        />
      </div>

      {/* Scale */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "var(--color-text-dim)",
            marginBottom: "2px",
          }}
        >
          SCALE — DRAG TO ADJUST
        </span>
        <DragInput
          label="X"
          value={scale.x}
          onChange={(v) => onScaleChange("x", v)}
          color="#ff4444"
          step={0.01}
        />
        <DragInput
          label="Y"
          value={scale.y}
          onChange={(v) => onScaleChange("y", v)}
          color="#44ff44"
          step={0.01}
        />
        <DragInput
          label="Z"
          value={scale.z}
          onChange={(v) => onScaleChange("z", v)}
          color="#4488ff"
          step={0.01}
        />
      </div>
    </div>
  );
}
