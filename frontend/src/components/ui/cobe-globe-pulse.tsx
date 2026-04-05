"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

interface PulseMarker {
  id: string
  location: [number, number]
  delay: number
}

interface GlobePulseProps {
  markers?: PulseMarker[]
  className?: string
  speed?: number
  paused?: boolean
  focusLocation?: [number, number] | null
  onMarkerClick?: (marker: PulseMarker) => void
}

const defaultMarkers: PulseMarker[] = [
  { id: "pulse-1", location: [51.51, -0.13], delay: 0 },
  { id: "pulse-2", location: [40.71, -74.01], delay: 0.5 },
  { id: "pulse-3", location: [35.68, 139.65], delay: 1 },
  { id: "pulse-4", location: [-33.87, 151.21], delay: 1.5 },
]

export function GlobePulse({
  markers = defaultMarkers,
  className = "",
  speed = 0.003,
  paused: pausedProp = false,
  focusLocation = null,
  onMarkerClick
}: GlobePulseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const isAnimatingToTargetRef = useRef(false)
  const targetPhiRef = useRef(0)
  const targetThetaRef = useRef(0)
  const currentPhiRef = useRef(0)
  const currentThetaRef = useRef(0.2)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  // Rotate to focus location when prop changes
  useEffect(() => {
    if (!focusLocation) return
    const [lat, lng] = focusLocation
    // Correct cobe phi formula: phi = -PI/2 - (lng * PI/180)
    targetPhiRef.current = -Math.PI / 2 - (lng * Math.PI / 180)
    targetThetaRef.current = lat * (Math.PI / 180)
    isAnimatingToTargetRef.current = true
    isPausedRef.current = false
  }, [focusLocation])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 0

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return

      globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width, height: width,
      phi: 0, theta: 0.2, dark: 1, diffuse: 1.5,
      mapSamples: 16000, mapBrightness: 10,
      baseColor: [0.35, 0.35, 0.35],  // lighter base since glow is reduced
      markerColor: [0.2, 0.8, 0.9],
      glowColor: [0.05, 0.35, 0.2],   // reduced intensity for a subtle cinematic glow
      markerElevation: 0,
      markers: markers.map((m) => ({ location: m.location, size: 0.025, id: m.id })),
      arcs: [], arcColor: [0.3, 0.85, 0.95],
      arcWidth: 0.5, arcHeight: 0.25, opacity: 0.7,
    })
    function animate() {
      if (isAnimatingToTargetRef.current) {
        // Directly lerp phi to target (not via offsets — avoids accumulated drift)
        let dphi = targetPhiRef.current - phi
        // Shortest path normalization
        dphi = ((dphi + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
        phi += dphi * 0.08

        const dtheta = targetThetaRef.current - currentThetaRef.current
        currentThetaRef.current += dtheta * 0.08

        // Convergence check
        let rem = targetPhiRef.current - phi
        rem = ((rem + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
        if (Math.abs(rem) < 0.005 && Math.abs(dtheta) < 0.005) {
          phi = targetPhiRef.current
          currentThetaRef.current = targetThetaRef.current
          isAnimatingToTargetRef.current = false
          isPausedRef.current = true
          phiOffsetRef.current = 0
          thetaOffsetRef.current = 0
        }

        globe!.update({ phi, theta: currentThetaRef.current })
      } else {
        if (!isPausedRef.current && !pausedProp) {
          phi += speed
        }
        const finalPhi = phi + phiOffsetRef.current + dragOffset.current.phi
        const finalTheta = currentThetaRef.current + thetaOffsetRef.current + dragOffset.current.theta
        currentPhiRef.current = finalPhi

        globe!.update({ phi: finalPhi, theta: finalTheta })
      }
      animationId = requestAnimationFrame(animate)
    }
      animate()
      setTimeout(() => canvas && (canvas.style.opacity = "1"))
    }

    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [markers, speed])

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <style>{`
        @keyframes pulse-expand {
          0% { transform: scaleX(0.3) scaleY(0.3); opacity: 0.8; }
          100% { transform: scaleX(1.5) scaleY(1.5); opacity: 0; }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%", height: "100%", cursor: "grab", opacity: 0,
          transition: "opacity 1.2s ease", borderRadius: "50%", touchAction: "none",
        }}
      />
      {markers.map((m) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            // @ts-ignore CSS Anchor Positioning
            positionAnchor: `--cobe-${m.id}`,
            bottom: "anchor(center)",
            left: "anchor(center)",
            translate: "-50% 50%",
            width: 40, height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            cursor: onMarkerClick ? "pointer" : "default",
            opacity: `var(--cobe-visible-${m.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
            transition: "opacity 0.4s, filter 0.4s",
          }}
          onClick={(e) => {
            e.stopPropagation()
            const [lat, lng] = m.location
            targetPhiRef.current = -Math.PI / 2 - (lng * Math.PI / 180)
            targetThetaRef.current = lat * (Math.PI / 180)
            isAnimatingToTargetRef.current = true
            isPausedRef.current = false
            if (onMarkerClick) onMarkerClick(m)
          }}
        >
          <span style={{
            position: "absolute", inset: 0,
            border: "2px solid #33ccdd", borderRadius: "50%", opacity: 0,
            animation: `pulse-expand 2s ease-out infinite ${m.delay}s`,
          }} />
          <span style={{
            position: "absolute", inset: 0,
            border: "2px solid #33ccdd", borderRadius: "50%", opacity: 0,
            animation: `pulse-expand 2s ease-out infinite ${m.delay + 0.5}s`,
          }} />
          <span style={{
            width: 10, height: 10, background: "#33ccdd", borderRadius: "50%",
            boxShadow: "0 0 0 3px #111, 0 0 0 5px #33ccdd",
          }} />
        </div>
      ))}
    </div>
  )
}
