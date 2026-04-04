"use client";

import { useState, useCallback } from "react";

interface SimulationPromptProps {
  onSubmit: (prompt: string) => void;
  isSimulating: boolean;
}

export default function SimulationPrompt({
  onSubmit,
  isSimulating,
}: SimulationPromptProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || isSimulating) return;
    onSubmit(trimmed);
    setValue("");
  }, [value, isSimulating, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 40,
        width: "min(600px, 90vw)",
      }}
    >
      {isSimulating ? (
        <div
          className="glow-cyan"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "12px 20px",
            background: "rgba(0, 0, 0, 0.85)",
            border: "1px solid rgba(0, 229, 255, 0.3)",
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.15em",
            color: "var(--color-accent-cyan)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-accent-cyan)",
              animation: "sim-pulse 1.2s ease-in-out infinite",
            }}
          />
          GENERATING SIMULATION...
          <style>{`
            @keyframes sim-pulse {
              0%, 100% { opacity: 0.3; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }
          `}</style>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            background: "rgba(0, 0, 0, 0.85)",
            border: "1px solid rgba(0, 229, 255, 0.25)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe scenario..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "12px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              letterSpacing: "0.05em",
              color: "var(--color-text)",
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={value.trim().length === 0}
            style={{
              background: "rgba(0, 229, 255, 0.1)",
              border: "none",
              borderLeft: "1px solid rgba(0, 229, 255, 0.2)",
              padding: "12px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--color-accent-cyan)",
              cursor: value.trim().length === 0 ? "default" : "pointer",
              opacity: value.trim().length === 0 ? 0.3 : 1,
              transition: "opacity var(--duration-fast) ease, background var(--duration-fast) ease",
            }}
            onMouseEnter={(e) => {
              if (value.trim().length > 0) {
                (e.target as HTMLButtonElement).style.background =
                  "rgba(0, 229, 255, 0.2)";
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background =
                "rgba(0, 229, 255, 0.1)";
            }}
          >
            SIMULATE
          </button>
        </div>
      )}
    </div>
  );
}
