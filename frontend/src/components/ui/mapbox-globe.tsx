"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

interface MapboxGlobeMarker {
  id: string
  location: [number, number] // [lat, lng]
  delay: number
}

interface MapboxGlobeProps {
  markers?: MapboxGlobeMarker[]
  className?: string
  speed?: number // deg/frame for rotation
  paused?: boolean
  onMarkerClick?: (marker: MapboxGlobeMarker) => void
  onMapClick?: () => void
  flyToTarget?: [number, number] | null // [lat, lng]
  onFlyToComplete?: () => void
  token: string
}

export function MapboxGlobe({
  markers = [],
  className = "",
  speed = 0.12,
  paused = false,
  onMarkerClick,
  onMapClick,
  flyToTarget = null,
  onFlyToComplete,
  token,
}: MapboxGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const rotationRef = useRef<number>(0)
  const isPausedRef = useRef(false)
  const isFlyingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const hasFlewRef = useRef(false)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      projection: "globe" as any,
      center: [-98.5, 39.8],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
      antialias: true,
      attributionControl: false,
      logoPosition: "bottom-left",
    })

    mapRef.current = map

    // Drag detection
    map.on("mousedown", () => { isDraggingRef.current = true })
    map.on("mouseup", () => { isDraggingRef.current = false })
    map.on("dragstart", () => { isDraggingRef.current = true })
    map.on("dragend", () => { isDraggingRef.current = false })
    map.on("touchstart", () => { isDraggingRef.current = true })
    map.on("touchend", () => { isDraggingRef.current = false })
    map.on("click", () => { if (onMapClick) onMapClick() })

    map.on("style.load", () => {
      // Subtle cyan atmospheric glow around the globe limb
      map.setFog({
        color: "rgba(0, 120, 220, 0.10)",
        "high-color": "rgba(0, 60, 160, 0.08)",
        "horizon-blend": 0.06,                   // tighter radius
        "space-color": "rgb(0, 0, 0)",
        "star-intensity": 0.0,
      } as any)

      // Hide labels at low zoom for clean globe look
      const style = map.getStyle()
      if (style?.layers) {
        for (const layer of style.layers) {
          if (layer.type === "symbol") {
            map.setLayoutProperty(layer.id, "visibility", "none")
          }
        }
      }

      // 3D buildings layer
      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "height"],
            0, "#001114",
            10, "#002b33",
            30, "#004859",
            60, "#006d80",
          ],
          "fill-extrusion-height": [
            "interpolate", ["linear"], ["zoom"],
            15, 0, 15.05, ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate", ["linear"], ["zoom"],
            15, 0, 15.05, ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.8,
        },
      })

      // Subtle cyan edge glow on building outlines
      map.addLayer({
        id: "3d-buildings-outline",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "line",
        minzoom: 15,
        paint: {
          "line-color": "rgba(0, 229, 255, 0.08)",
          "line-width": 0.5,
        },
      })

      setMapLoaded(true)

      // Add interaction source & layer for pixel-perfect hit testing on spinning globe
      map.addSource("interaction-points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: markers.map(m => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [m.location[1], m.location[0]] },
            properties: { id: m.id }
          }))
        }
      })

      map.addLayer({
        id: "interaction-layer",
        type: "circle",
        source: "interaction-points",
        paint: {
          "circle-radius": 25,
          "circle-color": "transparent",
          "circle-stroke-width": 0
        }
      })

      // Native map click handler for accuracy
      map.on("click", "interaction-layer", (e) => {
        if (e.features?.[0]?.properties?.id) {
          const mId = e.features[0].properties.id
          const marker = markers.find(m => m.id === mId)
          if (marker) {
            console.log("Native interact triggered:", mId)
            onMarkerClickRef.current?.(marker)
          }
        }
      })

      map.on("mouseenter", "interaction-layer", () => {
        map.getCanvas().style.cursor = "pointer"
      })

      map.on("mouseleave", "interaction-layer", () => {
        map.getCanvas().style.cursor = ""
      })
    })

    // Auto-rotation loop
    let animationId: number
    function rotate() {
      if (
        mapRef.current && 
        !isPausedRef.current && 
        !isFlyingRef.current && 
        !isDraggingRef.current &&
        !mapRef.current.isZooming()
      ) {
        const center = mapRef.current.getCenter()
        center.lng += speed
        mapRef.current.setCenter(center)
      }
      animationId = requestAnimationFrame(rotate)
    }
    rotate() // Initial trigger
    return () => {
      cancelAnimationFrame(animationId)
      markersRef.current.forEach(m => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, [token, speed])

  // Stability ref for callback to prevent marker re-creation on every state change
  const onMarkerClickRef = useRef(onMarkerClick)
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])

  // Sync external pause prop
  useEffect(() => {
    isPausedRef.current = paused
  }, [paused])

  // Create markers when map is loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    markers.forEach((m) => {
      const el = document.createElement("div")
      el.className = "mapbox-pulse-marker"
      el.innerHTML = `
        <span class="pulse-ring" style="animation-delay: ${m.delay}s"></span>
        <span class="pulse-ring" style="animation-delay: ${m.delay + 0.5}s"></span>
        <span class="pulse-dot"></span>
        <div class="marker-label">${m.id === "hall-ds-ai" ? "TARGET_DS_AI" : "SCAN_POINT"}</div>
      `
      el.style.cursor = onMarkerClick ? "pointer" : "default"

      // DOM element only for visual pulse, interaction handled by layer above
      if (onMarkerClick) {
        // No-op individual listener, handled via map.on('click', 'interaction-layer')
      }

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([m.location[1], m.location[0]])
        .addTo(mapRef.current!)

      markersRef.current.push(marker)
    })
  }, [mapLoaded, markers]) // Removed onMarkerClick from deps to prevent re-creation

  // flyTo when target changes
  useEffect(() => {
    if (!flyToTarget || !mapRef.current || !mapLoaded) return

    const [lat, lng] = flyToTarget
    isFlyingRef.current = true
    isPausedRef.current = true
    hasFlewRef.current = true

    // Re-enable labels during flyTo so city names appear as we zoom in
    const style = mapRef.current.getStyle()
    if (style?.layers) {
      for (const layer of style.layers) {
        if (layer.type === "symbol" && layer.id.includes("label")) {
          mapRef.current.setLayoutProperty(layer.id, "visibility", "visible")
        }
      }
    }

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 19.5,
      pitch: 75,
      bearing: -25,
      speed: 0.8,
      essential: true,
      easing: (t: number) => {
        // Fast start, slow middle, fast end (cubic ease-in-out)
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      },
    })

    const handleMoveEnd = () => {
      isFlyingRef.current = false
      if (onFlyToComplete) onFlyToComplete()
      mapRef.current?.off("moveend", handleMoveEnd)
    }
    mapRef.current.on("moveend", handleMoveEnd)
  }, [flyToTarget, mapLoaded, onFlyToComplete])

  // Zoom back to globe view when flyToTarget is cleared (but not on initial mount)
  useEffect(() => {
    if (flyToTarget === null && mapRef.current && mapLoaded && hasFlewRef.current) {
      // Hide labels again for clean globe look
      const style = mapRef.current.getStyle()
      if (style?.layers) {
        for (const layer of style.layers) {
          if (layer.type === "symbol") {
            mapRef.current!.setLayoutProperty(layer.id, "visibility", "none")
          }
        }
      }

      mapRef.current.flyTo({
        center: [mapRef.current.getCenter().lng, 39.8],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        speed: 1.5,
        essential: true,
      })

      hasFlewRef.current = false
    }
  }, [flyToTarget, mapLoaded])

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <style>{`
        .mapbox-pulse-marker {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          transition: transform 0.2s ease;
        }
        .mapbox-pulse-marker:hover {
          transform: scale(1.2);
        }
        .mapbox-pulse-marker .pulse-ring {
          position: absolute;
          inset: 0;
          border: 2px solid #00e5ff;
          border-radius: 50%;
          opacity: 0;
          animation: mapbox-pulse-expand 2s ease-out infinite;
        }
        .mapbox-pulse-marker .pulse-dot {
          width: 12px;
          height: 12px;
          background: #00e5ff;
          border-radius: 50%;
          box-shadow: 0 0 0 3px #000, 0 0 10px #00e5ff;
          transition: all 0.2s ease;
          z-index: 2;
        }
        .mapbox-pulse-marker:hover .pulse-dot {
          background: #fff;
          box-shadow: 0 0 20px #00e5ff;
          transform: scale(1.3);
        }
        .marker-label {
          position: absolute;
          bottom: -20px;
          font-family: var(--font-space-mono), monospace;
          font-size: 8px;
          color: rgba(0, 229, 255, 0.6);
          letter-spacing: 0.1em;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .mapbox-pulse-marker:hover .marker-label {
          opacity: 1;
        }
        @keyframes mapbox-pulse-expand {
          0% { transform: scale(0.3); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .mapboxgl-ctrl-logo { display: none !important; }
      `}</style>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          opacity: mapLoaded ? 1 : 0,
          transition: "opacity 1.2s ease",
        }}
      />
    </div>
  )
}
