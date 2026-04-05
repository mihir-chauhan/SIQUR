"use client"

import { useState } from "react"
import { GlobePulse } from "@/components/ui/cobe-globe-pulse"
import { LocationMap } from "@/components/ui/expand-map"
import { AnimatePresence, motion } from "framer-motion"

interface LocationData {
  id: string
  name: string
  coordinates: string
  location: [number, number]
}

const LocationDatabase: Record<string, { name: string, coordinates: string }> = {
  "pulse-1": { name: "London, UK // Alpha Point", coordinates: "51.5074° N, 0.1278° W" },
  "pulse-2": { name: "New York, USA // Beta Node", coordinates: "40.7128° N, 74.0060° W" },
  "pulse-3": { name: "Tokyo, JPN // Gamma Hub", coordinates: "35.6762° N, 139.6503° E" },
  "pulse-4": { name: "Sydney, AUS // Delta Link", coordinates: "33.8688° S, 151.2093° E" },
}

export default function GlobeDemoPage() {
  const [activeTarget, setActiveTarget] = useState<LocationData | null>(null)

  const handleGlobeClick = (marker: { id: string, location: [number, number] }) => {
    const data = LocationDatabase[marker.id] || { name: "Unknown Sector", coordinates: "N/A" }
    setActiveTarget({ ...marker, ...data })
  }

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-black overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.05)_0%,_black_70%)] pointer-events-none" />

      <div className="w-full h-full absolute inset-0 flex items-center justify-center z-0">
        <div className="w-full max-w-2xl opacity-80">
            <GlobePulse onMarkerClick={handleGlobeClick} />
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-8">
          <div className="w-full flex justify-between items-start">
             <div className="flex flex-col">
                 <h1 className="text-emerald-400 font-mono text-xs tracking-[0.3em] font-medium">GLOBAL_OVERSEER v2.4</h1>
                 <p className="text-zinc-600 font-mono text-[10px] tracking-widest mt-1">AWAITING TARGET SELECTION...</p>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                 <span className="text-zinc-500 font-mono text-[10px] tracking-widest">SAT-LINK ONLINE</span>
             </div>
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 left-16 md:left-24">
             <AnimatePresence mode="wait">
                {activeTarget && (
                    <motion.div
                        key={activeTarget.id}
                        initial={{ opacity: 0, x: -50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="pointer-events-auto shadow-2xl shadow-emerald-900/40 rounded-2xl"
                    >
                        <LocationMap
                            location={activeTarget.name}
                            coordinates={activeTarget.coordinates}
                            onClose={() => setActiveTarget(null)}
                        />
                    </motion.div>
                )}
             </AnimatePresence>
          </div>
      </div>
    </div>
  )
}
