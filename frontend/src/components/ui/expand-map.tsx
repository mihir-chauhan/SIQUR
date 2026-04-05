"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion"
import { Map as MapIcon, Target, X } from "lucide-react"

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
  const isExpanded = true // Always expanded now, clicking goes to full building view
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-50, 50], [8, -8])
  const rotateY = useTransform(mouseX, [-50, 50], [-8, 8])

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

  return (
    <motion.div
      ref={containerRef}
      className={`relative cursor-pointer select-none ${className}`}
      style={{
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl bg-black border border-emerald-900/40 backdrop-blur-xl shadow-2xl shadow-emerald-900/20"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          width: isExpanded ? 360 : 240,
          height: isExpanded ? 280 : 140,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 35,
        }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/10" />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="absolute inset-0 bg-[#050505]" />

              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                {/* Main roads - using foreground with opacity */}
                <motion.line
                  x1="0%"
                  y1="35%"
                  x2="100%"
                  y2="35%"
                  className="stroke-emerald-500/25"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <motion.line
                  x1="0%"
                  y1="65%"
                  x2="100%"
                  y2="65%"
                  className="stroke-emerald-500/25"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />

                {/* Vertical main roads */}
                <motion.line
                  x1="30%"
                  y1="0%"
                  x2="30%"
                  y2="100%"
                  className="stroke-emerald-500/20"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                />
                <motion.line
                  x1="70%"
                  y1="0%"
                  x2="70%"
                  y2="100%"
                  className="stroke-emerald-500/20"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />

                {/* Secondary streets */}
                {[20, 50, 80].map((y, i) => (
                  <motion.line
                    key={`h-${i}`}
                    x1="0%"
                    y1={`${y}%`}
                    x2="100%"
                    y2={`${y}%`}
                    className="stroke-emerald-500/10"
                    strokeWidth="1"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                  />
                ))}
                {[15, 45, 55, 85].map((x, i) => (
                  <motion.line
                    key={`v-${i}`}
                    x1={`${x}%`}
                    y1="0%"
                    x2={`${x}%`}
                    y2="100%"
                    className="stroke-emerald-500/10"
                    strokeWidth="1"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                  />
                ))}
              </svg>

              {/* Buildings - using muted-foreground */}
              <motion.div
                className="absolute top-[40%] left-[10%] w-[15%] h-[20%] rounded-sm bg-emerald-950/40 border border-emerald-900/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              />
              <motion.div
                className="absolute top-[15%] left-[35%] w-[12%] h-[15%] rounded-sm bg-emerald-950/30 border border-emerald-900/20"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              />
              <motion.div
                className="absolute top-[70%] left-[75%] w-[18%] h-[18%] rounded-sm bg-emerald-950/40 border border-emerald-900/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 }}
              />
              <motion.div
                className="absolute top-[20%] right-[10%] w-[10%] h-[25%] rounded-sm bg-emerald-950/30 border border-emerald-900/20"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.55 }}
              />

              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
              >
                  <Target className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" size={32} strokeWidth={1.5} />
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-5">
          {/* Top section */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative"
                animate={{
                  opacity: isExpanded ? 0 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                 <MapIcon size={18} className="text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
              </motion.div>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
                <motion.div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/30 backdrop-blur-sm"
                animate={{
                    scale: isHovered ? 1.05 : 1,
                }}
                transition={{ duration: 0.2 }}
                >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-400 tracking-wide uppercase">Live Context</span>
                </motion.div>

                {onClose && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto z-50"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
          </div>

          {/* Bottom section */}
          <div className="space-y-1">
            <motion.h3
              className="text-white font-medium text-sm tracking-tight"
              animate={{
                x: isHovered ? 4 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {location}
            </motion.h3>

            <AnimatePresence>
              {isExpanded && (
                <motion.p
                  className="text-emerald-400/80 text-xs font-mono"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {coordinates}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Animated underline */}
            <motion.div
              className="h-px bg-gradient-to-r from-emerald-500/80 via-emerald-400/30 to-transparent"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{
                scaleX: isHovered || isExpanded ? 1 : 0.3,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

      </motion.div>
    </motion.div>
  )
}
