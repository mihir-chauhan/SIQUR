import type { Building } from "./types";

// Real GPS coordinates from OpenStreetMap Nominatim
// Coordinate offsets reference (at ~lat 40.4°):
//   1° lat  ≈ 111,000 m  →  1 m ≈ 0.000009009° lat
//   1° lng  ≈  84,500 m  →  1 m ≈ 0.000011834° lng

export const PRELOADED_BUILDINGS: Building[] = [
  {
    id: "purdue-lawson",
    name: "Lawson Computer Science Building",
    lat: 40.4278,
    lng: -86.9170,
    // ~80m E-W × 40m N-S, L-shaped
    footprint_polygon: [
      [40.42762, -86.91748], // SW
      [40.42762, -86.91653], // SE
      [40.42785, -86.91653], // ESE step
      [40.42785, -86.91701], // L notch inner
      [40.42798, -86.91701], // NE main wing
      [40.42798, -86.91748], // NW
    ],
    splat_asset: "lawson.splat",
  },
  {
    id: "purdue-pmu",
    name: "Purdue Memorial Union",
    lat: 40.4247,
    lng: -86.9106,
    // ~120m E-W × 60m N-S, irregular complex
    footprint_polygon: [
      [40.42443, -86.91131], // SW
      [40.42443, -86.90989], // SE
      [40.42470, -86.90989], // ESE notch
      [40.42470, -86.91060], // ESE notch inner
      [40.42497, -86.91060], // NE east wing
      [40.42497, -86.91131], // NW east wing
      [40.42483, -86.91131], // step back W
      [40.42483, -86.91170], // NW corner west wing
      [40.42443, -86.91170], // SW west wing
    ],
    splat_asset: "pmu.splat",
  },
  {
    id: "purdue-armstrong",
    name: "Neil Armstrong Hall of Engineering",
    lat: 40.4314,
    lng: -86.9193,
    // ~80m E-W × 50m N-S, rectangular with wing
    footprint_polygon: [
      [40.43118, -86.91977], // SW
      [40.43118, -86.91883], // SE
      [40.43163, -86.91883], // NE
      [40.43163, -86.91977], // NW
    ],
    splat_asset: "armstrong.splat",
  },
];
