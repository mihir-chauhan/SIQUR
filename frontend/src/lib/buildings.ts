import type { Building } from "./types";

// Coordinate offsets reference (at ~lat 40.4°):
//   1° lat  ≈ 111,000 m  →  1 m ≈ 0.000009009° lat
//   1° lng  ≈  84,500 m  →  1 m ≈ 0.000011834° lng

export const PRELOADED_BUILDINGS: Building[] = [
  {
    id: "purdue-lawson",
    name: "Lawson Computer Science Building",
    lat: 40.4274,
    lng: -86.9167,
    // Roughly 80 m (E-W) × 40 m (N-S) with an L-shaped notch cut from the NE corner
    // 80 m lng offset  ≈ 0.000947°   |  40 m lat offset ≈ 0.000360°
    // 50 m lng offset  ≈ 0.000592°   |  25 m lat offset ≈ 0.000225°
    footprint_polygon: [
      [40.42722, -86.91718], // SW corner
      [40.42722, -86.91623], // SE corner
      [40.42745, -86.91623], // ESE step (L notch bottom)
      [40.42745, -86.91671], // ENE step (L notch inner corner)
      [40.42758, -86.91671], // NE of main wing top
      [40.42758, -86.91718], // NW corner
    ],
    splat_asset: "lawson.splat",
  },
  {
    id: "purdue-pmu",
    name: "Purdue Memorial Union",
    lat: 40.4256,
    lng: -86.9094,
    // Roughly 120 m (E-W) × 60 m (N-S) irregular complex
    // 120 m lng offset ≈ 0.001420°   |  60 m lat offset ≈ 0.000540°
    //  60 m lng offset ≈ 0.000710°   |  30 m lat offset ≈ 0.000270°
    footprint_polygon: [
      [40.42533, -86.91011], // SW
      [40.42533, -86.90869], // SE
      [40.42560, -86.90869], // ESE notch start
      [40.42560, -86.90940], // ESE notch inner
      [40.42587, -86.90940], // NE of east wing
      [40.42587, -86.91011], // NW of east wing
      [40.42573, -86.91011], // step back W
      [40.42573, -86.91050], // NW corner of west wing
      [40.42533, -86.91050], // SW of west wing back to start
    ],
    splat_asset: "pmu.splat",
  },
  {
    id: "purdue-armstrong",
    name: "Armstrong Hall",
    lat: 40.4268,
    lng: -86.9145,
    // Roughly 60 m (E-W) × 30 m (N-S) simple rectangle
    // 60 m lng offset ≈ 0.000710°   |  30 m lat offset ≈ 0.000270°
    footprint_polygon: [
      [40.42666, -86.91485], // SW
      [40.42666, -86.91414], // SE
      [40.42693, -86.91414], // NE
      [40.42693, -86.91485], // NW
    ],
    splat_asset: "armstrong.splat",
  },
];
