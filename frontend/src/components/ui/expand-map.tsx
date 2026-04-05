"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion"
import { Target, X } from "lucide-react"

interface LocationMapProps {
  location?: string
  coordinates?: string
  className?: string
  onClose?: () => void
}

export function LocationMap({
  location = "San Francisco, CA",
  coordinates = "37.7749° N, 122.4194° W",
  className,
  onClose
}: LocationMapProps) {
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-50, 50], [5, -5])
  const rotateY = useTransform(mouseX, [-50, 50], [-5, 5])

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    mouseX.set(e.clientX - centerX)
    mouseY.set(e.clientY - centerY)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    setIsHovered(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    router.push("/v2/building")
  }

  // Blueprint colors
  const wall = "rgba(100, 180, 255, 0.45)"
  const wallThick = "rgba(100, 180, 255, 0.6)"
  const room = "rgba(40, 100, 200, 0.06)"
  const label = "rgba(100, 180, 255, 0.4)"
  const labelDim = "rgba(100, 180, 255, 0.25)"
  const dim = "rgba(100, 180, 255, 0.18)"
  const grid = "rgba(60, 120, 200, 0.06)"

  return (
    <motion.div
      ref={containerRef}
      className={`relative cursor-pointer select-none ${className}`}
      style={{ perspective: 1200 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      initial={{ scale: 0.85, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.85, opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <motion.div
        className="relative overflow-hidden rounded-xl border backdrop-blur-xl shadow-2xl"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: "preserve-3d",
          background: "linear-gradient(145deg, #0a1628 0%, #060e1a 50%, #081020 100%)",
          borderColor: "rgba(80, 150, 255, 0.2)",
          boxShadow: "0 25px 60px rgba(0, 80, 200, 0.15), inset 0 1px 0 rgba(100, 180, 255, 0.05)",
          width: 600,
          height: 500,
        }}
      >
        {/* Blueprint background */}
        <div className="absolute inset-0">
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {Array.from({ length: 25 }, (_, i) => (
              <line key={`gh-${i}`} x1="0" y1={`${(i + 1) * 4}%`} x2="100%" y2={`${(i + 1) * 4}%`}
                stroke={grid} strokeWidth="0.5" />
            ))}
            {Array.from({ length: 30 }, (_, i) => (
              <line key={`gv-${i}`} x1={`${(i + 1) * 3.33}%`} y1="0" x2={`${(i + 1) * 3.33}%`} y2="100%"
                stroke={grid} strokeWidth="0.5" />
            ))}
          </svg>
        </div>

        {/* Floor plan */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet">

          {/* ── Outer walls ── */}
          <motion.rect x="35" y="55" width="530" height="370" rx="1"
            fill="none" stroke={wallThick} strokeWidth="3"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }} />

          {/* ── Main corridors (dashed) ── */}
          <motion.line x1="35" y1="235" x2="565" y2="235"
            stroke={dim} strokeWidth="1" strokeDasharray="6 4"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }} />
          <motion.line x1="220" y1="55" x2="220" y2="425"
            stroke={dim} strokeWidth="1" strokeDasharray="6 4"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }} />

          {/* ═══ WING A: Top-left — Lecture Hall ═══ */}
          <motion.rect x="45" y="65" width="165" height="160" rx="1"
            fill={room} stroke={wall} strokeWidth="2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }} />
          {/* Tiered seating rows */}
          {[0, 1, 2, 3, 4].map(i => (
            <motion.line key={`seat-${i}`} x1="65" y1={95 + i * 24} x2="190" y2={95 + i * 24}
              stroke={dim} strokeWidth="0.8"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.03 }} />
          ))}
          <text x="128" y="85" textAnchor="middle" fill={label}
            fontSize="7.5" fontFamily="monospace" letterSpacing="0.12em">LECTURE HALL A</text>
          <text x="128" y="215" textAnchor="middle" fill={labelDim}
            fontSize="5.5" fontFamily="monospace">18.2m × 12.4m</text>
          {/* Door arc */}
          <motion.path d="M 210 130 A 15 15 0 0 1 210 160" fill="none" stroke={wall} strokeWidth="1"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.55 }} />
          <motion.line x1="210" y1="130" x2="210" y2="160"
            stroke={wallThick} strokeWidth="0.5" strokeDasharray="3 2"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, delay: 0.6 }} />

          {/* ═══ WING B: Top-right — AI Lab ═══ */}
          <motion.rect x="230" y="65" width="150" height="80" rx="1"
            fill={room} stroke={wall} strokeWidth="2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.45 }} />
          {/* Workstation dots */}
          {[0, 1, 2].map(row => [0, 1, 2, 3].map(col => (
            <circle key={`ws-${row}-${col}`} cx={255 + col * 32} cy={90 + row * 18} r="2"
              fill={labelDim} />
          )))}
          <text x="305" y="82" textAnchor="middle" fill={label}
            fontSize="7" fontFamily="monospace" letterSpacing="0.1em">AI LAB</text>
          <text x="305" y="137" textAnchor="middle" fill={labelDim}
            fontSize="5" fontFamily="monospace">12 WORKSTATIONS</text>

          {/* ═══ WING C: Top-far-right — Server Room ═══ */}
          <motion.rect x="390" y="65" width="165" height="80" rx="1"
            fill="rgba(40, 80, 200, 0.08)" stroke={wall} strokeWidth="2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }} />
          {/* Server racks */}
          {[0, 1, 2, 3, 4].map(i => (
            <motion.rect key={`rack-${i}`} x={405 + i * 30} y="85" width="18" height="40" rx="1"
              fill="rgba(60, 130, 255, 0.08)" stroke={dim} strokeWidth="0.8"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.55 + i * 0.03 }} />
          ))}
          <text x="472" y="82" textAnchor="middle" fill={label}
            fontSize="7" fontFamily="monospace" letterSpacing="0.1em">SERVER ROOM</text>
          <text x="472" y="137" textAnchor="middle" fill={labelDim}
            fontSize="5" fontFamily="monospace">RESTRICTED ACCESS</text>

          {/* ═══ Offices row — mid right ═══ */}
          {[0, 1, 2, 3, 4].map(i => (
            <motion.rect key={`off-${i}`} x={230 + i * 67} y="155" width="60" height="70" rx="1"
              fill={room} stroke={wall} strokeWidth="1.2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.52 + i * 0.04 }} />
          ))}
          {[0, 1, 2, 3, 4].map(i => (
            <text key={`offlbl-${i}`} x={260 + i * 67} y="195" textAnchor="middle" fill={labelDim}
              fontSize="5" fontFamily="monospace">{`OFF-${i + 1}`}</text>
          ))}

          {/* ═══ WING D: Bottom-left — Data Center ═══ */}
          <motion.rect x="45" y="245" width="165" height="170" rx="1"
            fill="rgba(40, 80, 200, 0.08)" stroke={wall} strokeWidth="2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.55 }} />
          {/* Rack grid */}
          {[0, 1, 2].map(row => [0, 1, 2].map(col => (
            <motion.rect key={`dc-${row}-${col}`} x={65 + col * 45} y={275 + row * 40} width="30" height="25" rx="1"
              fill="rgba(60, 130, 255, 0.06)" stroke={dim} strokeWidth="0.8"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.6 + (row * 3 + col) * 0.02 }} />
          )))}
          <text x="128" y="265" textAnchor="middle" fill={label}
            fontSize="7.5" fontFamily="monospace" letterSpacing="0.12em">DATA CENTER</text>
          <text x="128" y="408" textAnchor="middle" fill={labelDim}
            fontSize="5" fontFamily="monospace">CLIMATE CONTROLLED</text>

          {/* ═══ WING E: Bottom-mid — Seminar Rooms ═══ */}
          <motion.rect x="230" y="245" width="150" height="75" rx="1"
            fill={room} stroke={wall} strokeWidth="1.5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.58 }} />
          {/* Table */}
          <motion.rect x="275" y="265" width="60" height="30" rx="2"
            fill="none" stroke={dim} strokeWidth="1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.65 }} />
          <text x="305" y="260" textAnchor="middle" fill={label}
            fontSize="6.5" fontFamily="monospace">SEMINAR A</text>

          <motion.rect x="390" y="245" width="165" height="75" rx="1"
            fill={room} stroke={wall} strokeWidth="1.5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.62 }} />
          <motion.rect x="440" y="265" width="65" height="30" rx="2"
            fill="none" stroke={dim} strokeWidth="1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.68 }} />
          <text x="472" y="260" textAnchor="middle" fill={label}
            fontSize="6.5" fontFamily="monospace">SEMINAR B</text>

          {/* ═══ Lobby — bottom spanning ═══ */}
          <motion.rect x="230" y="330" width="325" height="85" rx="1"
            fill="rgba(40, 100, 200, 0.04)" stroke={wall} strokeWidth="2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.65 }} />
          <text x="392" y="378" textAnchor="middle" fill={label}
            fontSize="8" fontFamily="monospace" letterSpacing="0.2em">MAIN LOBBY</text>

          {/* Entry doors with swing arcs */}
          <motion.path d="M 370 425 A 20 20 0 0 0 390 425" fill="none" stroke={wallThick} strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }} />
          <motion.path d="M 410 425 A 20 20 0 0 1 430 425" fill="none" stroke={wallThick} strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.82 }} />
          <motion.line x1="370" y1="425" x2="430" y2="425"
            stroke={wallThick} strokeWidth="2.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.85 }} />
          <text x="400" y="445" textAnchor="middle" fill={label}
            fontSize="6" fontFamily="monospace" letterSpacing="0.15em">MAIN ENTRY</text>

          {/* ── Dimension lines ── */}
          {/* Top width */}
          <motion.line x1="35" y1="45" x2="565" y2="45"
            stroke={dim} strokeWidth="0.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.9 }} />
          <line x1="35" y1="42" x2="35" y2="48" stroke={dim} strokeWidth="0.5" />
          <line x1="565" y1="42" x2="565" y2="48" stroke={dim} strokeWidth="0.5" />
          <text x="300" y="43" textAnchor="middle" fill={labelDim}
            fontSize="5" fontFamily="monospace">52.8m</text>

          {/* Left height */}
          <motion.line x1="25" y1="55" x2="25" y2="425"
            stroke={dim} strokeWidth="0.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.92 }} />
          <line x1="22" y1="55" x2="28" y2="55" stroke={dim} strokeWidth="0.5" />
          <line x1="22" y1="425" x2="28" y2="425" stroke={dim} strokeWidth="0.5" />
          <text x="18" y="240" textAnchor="middle" fill={labelDim}
            fontSize="5" fontFamily="monospace" transform="rotate(-90 18 240)">36.4m</text>

          {/* Scale indicator bottom-right */}
          <line x1="510" y1="450" x2="560" y2="450" stroke={label} strokeWidth="1" />
          <line x1="510" y1="447" x2="510" y2="453" stroke={label} strokeWidth="0.8" />
          <line x1="560" y1="447" x2="560" y2="453" stroke={label} strokeWidth="0.8" />
          <text x="535" y="460" textAnchor="middle" fill={labelDim}
            fontSize="5" fontFamily="monospace">5m</text>

          {/* North arrow */}
          <motion.polygon points="560,75 565,90 555,90" fill={label}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.95 }} />
          <text x="560" y="100" textAnchor="middle" fill={labelDim}
            fontSize="6" fontFamily="monospace" fontWeight="bold">N</text>

          {/* Target reticle in center */}
          <motion.circle cx="300" cy="250" r="12" fill="none" stroke={wallThick} strokeWidth="1.5"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.7 }} />
          <motion.circle cx="300" cy="250" r="3" fill={wallThick}
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.75 }} />
          <motion.line x1="300" y1="232" x2="300" y2="242" stroke={wallThick} strokeWidth="1"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, delay: 0.78 }} />
          <motion.line x1="300" y1="258" x2="300" y2="268" stroke={wallThick} strokeWidth="1"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, delay: 0.78 }} />
          <motion.line x1="282" y1="250" x2="292" y2="250" stroke={wallThick} strokeWidth="1"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, delay: 0.78 }} />
          <motion.line x1="308" y1="250" x2="318" y2="250" stroke={wallThick} strokeWidth="1"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, delay: 0.78 }} />
        </svg>

        {/* Bottom gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628] via-transparent to-transparent opacity-70 pointer-events-none" />

        {/* Content overlay */}
        <div className="relative z-10 h-full flex flex-col justify-between p-5">
          {/* Top section */}
          <div className="flex items-start justify-between">
            <div>
              <span style={{
                fontFamily: "monospace",
                fontSize: "8px",
                letterSpacing: "0.2em",
                color: "rgba(100, 180, 255, 0.35)",
              }}>BLUEPRINT // FLOOR 1</span>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <motion.div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-sm"
                style={{
                  background: "rgba(30, 70, 140, 0.3)",
                  border: "1px solid rgba(80, 150, 255, 0.2)",
                }}
                animate={{ scale: isHovered ? 1.05 : 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(100, 180, 255, 0.8)" }} />
                <span style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "rgba(100, 180, 255, 0.7)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase" as const,
                }}>Live Context</span>
              </motion.div>

              {onClose && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="p-1 rounded-full transition-colors pointer-events-auto z-50"
                  style={{ color: "rgba(100, 180, 255, 0.4)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(100, 180, 255, 0.4)"; }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Bottom section */}
          <div className="space-y-1">
            <motion.h3
              style={{ color: "#fff", fontWeight: 500, fontSize: "14px", letterSpacing: "-0.01em" }}
              animate={{ x: isHovered ? 4 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {location}
            </motion.h3>

            <p style={{
              fontFamily: "monospace",
              fontSize: "11px",
              color: "rgba(100, 180, 255, 0.6)",
            }}>
              {coordinates}
            </p>

            {/* Animated underline */}
            <motion.div
              style={{ height: 1, background: "linear-gradient(90deg, rgba(100,180,255,0.6) 0%, rgba(100,180,255,0.15) 60%, transparent 100%)" }}
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: isHovered ? 1 : 0.4 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
