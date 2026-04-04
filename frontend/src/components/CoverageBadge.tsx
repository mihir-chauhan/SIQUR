"use client";

interface CoverageBadgeProps {
  score: number; // 0-1
}

function getCoverageColor(score: number): {
  text: string;
  glow: string;
  border: string;
  bg: string;
} {
  if (score >= 0.8) {
    return {
      text: "#00ff41",
      glow: "0 0 8px rgba(0,255,65,0.9), 0 0 20px rgba(0,255,65,0.55), 0 0 40px rgba(0,255,65,0.25)",
      border: "rgba(0,255,65,0.35)",
      bg: "rgba(0,255,65,0.07)",
    };
  }
  if (score >= 0.5) {
    return {
      text: "#ffd600",
      glow: "0 0 8px rgba(255,214,0,0.9), 0 0 20px rgba(255,214,0,0.55), 0 0 40px rgba(255,214,0,0.25)",
      border: "rgba(255,214,0,0.35)",
      bg: "rgba(255,214,0,0.07)",
    };
  }
  return {
    text: "#ff1744",
    glow: "0 0 8px rgba(255,23,68,0.9), 0 0 20px rgba(255,23,68,0.55), 0 0 40px rgba(255,23,68,0.25)",
    border: "rgba(255,23,68,0.35)",
    bg: "rgba(255,23,68,0.07)",
  };
}

export default function CoverageBadge({ score }: CoverageBadgeProps) {
  const pct = Math.round(score * 100);
  const { text, glow, border, bg } = getCoverageColor(score);

  // SVG arc for circular progress
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: "12px 16px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "4px",
        boxShadow: `0 0 0 1px ${border}, 0 0 16px ${bg}`,
        minWidth: "96px",
      }}
    >
      {/* Circular arc */}
      <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
        {/* Track */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="5"
        />
        {/* Progress arc */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={text}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 40 40)"
          style={{ filter: `drop-shadow(0 0 4px ${text})`, transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Center percentage */}
        <text
          x="40"
          y="44"
          textAnchor="middle"
          fill={text}
          fontSize="16"
          fontFamily="var(--font-space-mono, monospace)"
          fontWeight="700"
          style={{ textShadow: glow }}
        >
          {pct}%
        </text>
      </svg>

      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "9px",
          letterSpacing: "0.25em",
          color: text,
          textShadow: glow,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        COVERED
      </span>
    </div>
  );
}
