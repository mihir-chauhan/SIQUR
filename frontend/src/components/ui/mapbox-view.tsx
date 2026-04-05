"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

interface MapboxViewProps {
  token: string
  center?: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
  className?: string
}

export function MapboxView({
  token,
  center = [-86.9167, 40.4274],
  zoom = 16,
  pitch = 60,
  bearing = -17,
  className = "",
}: MapboxViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
      pitch,
      bearing,
      antialias: true,
    })

    mapRef.current = map

    map.on("style.load", () => {
      const layers = map.getStyle().layers
      const labelLayerId = layers?.find(
        (layer) => layer.type === "symbol" && layer.layout?.["text-field"]
      )?.id

      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#1a1a2e",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.85,
          },
        },
        labelLayerId
      )

      setLoaded(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [token, center, zoom, pitch, bearing])

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          opacity: loaded ? 1 : 0,
          transition: "opacity 800ms ease",
        }}
      />
    </div>
  )
}
