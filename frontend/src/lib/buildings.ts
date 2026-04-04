import type { Building } from "./types";

export const PRELOADED_BUILDINGS: Building[] = [
  {
    id: "purdue-lawson",
    name: "Lawson Computer Science Building",
    lat: 40.4274,
    lng: -86.9167,
    footprint_polygon: [
      [40.42740, -86.91670],
      [40.42750, -86.91660],
      [40.42750, -86.91680],
      [40.42740, -86.91680],
    ],
    splat_asset: "lawson.splat",
  },
  {
    id: "purdue-pmu",
    name: "Purdue Memorial Union",
    lat: 40.4256,
    lng: -86.9094,
    footprint_polygon: [
      [40.42560, -86.90940],
      [40.42570, -86.90930],
      [40.42570, -86.90950],
      [40.42560, -86.90950],
    ],
    splat_asset: "pmu.splat",
  },
  {
    id: "purdue-armstrong",
    name: "Armstrong Hall",
    lat: 40.4268,
    lng: -86.9145,
    footprint_polygon: [
      [40.42680, -86.91450],
      [40.42690, -86.91440],
      [40.42690, -86.91460],
      [40.42680, -86.91460],
    ],
    splat_asset: "armstrong.splat",
  },
];
