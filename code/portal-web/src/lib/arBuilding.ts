/**
 * Hardcoded cadastral record for the AR Scanner's image target
 * (src/assets/ar-target-building.jpg — "Ground + 5 floors modern apartment").
 *
 * This module is deliberately self-contained: the AR Scanner demo does not hit
 * the backend, so the floor records and their on-image geometry live together
 * here. Nothing else in the portal reads from it.
 */

/** Source image aspect (501 / 399) — MindAR normalises target width to 1. */
export const TARGET_ASPECT = 501 / 399

/*
 * Facade geometry, measured off the reference photo in normalised image space
 * (u, v from the top-left corner, both 0..1).
 *
 * The render is a standard arch-viz two-point perspective: verticals stay
 * vertical, so the three visible corners sit on fixed u values, and equal
 * storey heights along the near corner project to equal image distances. Every
 * horizontal slab line converges on a shared horizon as it recedes from that
 * corner, so a slab at near-corner height v sits at
 *   horizon - (horizon - v) * k
 * on each outer corner. Each face's (horizon, k) was recovered by searching for
 * the vanishing point that maps the photo's detected facade edges back onto the
 * known near-corner slab grid. The fit puts the facade's top corners at
 * (0.19, 0.354) and (0.885, 0.260), matching the traced silhouette.
 */
const NEAR_U = 0.425 // near vertical corner, closest to camera
const LEFT_U = 0.19 // left face's outer corner
const RIGHT_U = 0.885 // right face's outer corner
const HORIZON_LEFT = 0.834 // per-face fitted horizon; kept separate because
const HORIZON_RIGHT = 0.942 // each pair reproduces its own face's lines best
const RECEDE_LEFT = 0.671 // foreshortening toward the left corner
const RECEDE_RIGHT = 0.828 // ...and toward the right corner

/** Slab lines along the near corner: 7 evenly spaced edges = 6 storeys. */
const ROOF_SOFFIT_V = 0.118
const STOREY_V = 0.12317

const recedeLeft = (v: number) => HORIZON_LEFT - (HORIZON_LEFT - v) * RECEDE_LEFT
const recedeRight = (v: number) => HORIZON_RIGHT - (HORIZON_RIGHT - v) * RECEDE_RIGHT

export type UV = readonly [number, number]

/** Top storey — the highest `level` in AR_FLOORS. */
const TOP_LEVEL = 5

/**
 * Near-corner slab heights bounding one storey.
 * Level 0 is the stilt/parking band, {@link TOP_LEVEL} the topmost flat.
 */
function storeyBand(level: number): { topV: number; bottomV: number } {
  const fromTop = TOP_LEVEL - level
  return {
    topV: ROOF_SOFFIT_V + fromTop * STOREY_V,
    bottomV: ROOF_SOFFIT_V + (fromTop + 1) * STOREY_V,
  }
}

/**
 * The visible outline of one storey — a hexagon wrapping both visible faces,
 * traced clockwise from the top-left corner.
 */
export function floorOutline(level: number): UV[] {
  const { topV, bottomV } = storeyBand(level)
  return [
    [LEFT_U, recedeLeft(topV)],
    [NEAR_U, topV],
    [RIGHT_U, recedeRight(topV)],
    [RIGHT_U, recedeRight(bottomV)],
    [NEAR_U, bottomV],
    [LEFT_U, recedeLeft(bottomV)],
  ]
}

/** The near-corner fold, drawn inside each storey to read as 3D. */
export function floorFoldEdge(level: number): [UV, UV] {
  const { topV, bottomV } = storeyBand(level)
  return [
    [NEAR_U, topV],
    [NEAR_U, bottomV],
  ]
}

/** Where a storey's label chip is anchored — centre of the wider right face. */
export function floorLabelAnchor(level: number): UV {
  const { topV, bottomV } = storeyBand(level)
  return [(NEAR_U + RIGHT_U) / 2, (recedeRight(topV) + recedeRight(bottomV)) / 2]
}

export type ArFloor = {
  id: string
  /** 0 = stilt/parking level. */
  level: number
  label: string
  short: string
  ulpin: string
  owner: string
  propertyType: string
  areaSqM: number
  legalStatus: string
  matchConfidence: number
}

/**
 * Storeys read off the reference photo, top-down. Their on-image bands are
 * derived from `level` via the geometry above, so this list only carries the
 * cadastral record.
 */
export const AR_FLOORS: ArFloor[] = [
  {
    id: 'l5',
    level: 5,
    label: 'Fifth floor',
    short: 'F5',
    ulpin: '3D-IND-560012-B2-L5-501',
    owner: 'Meera Raghavan',
    propertyType: 'Residential · penthouse',
    areaSqM: 146,
    legalStatus: 'Freehold · registered',
    matchConfidence: 0.94,
  },
  {
    id: 'l4',
    level: 4,
    label: 'Fourth floor',
    short: 'F4',
    ulpin: '3D-IND-560012-B2-L4-401',
    owner: 'Vikram Iyer',
    propertyType: 'Residential · 3BHK',
    areaSqM: 128,
    legalStatus: 'Freehold · registered',
    matchConfidence: 0.91,
  },
  {
    id: 'l3',
    level: 3,
    label: 'Third floor',
    short: 'F3',
    ulpin: '3D-IND-560012-B2-L3-301',
    owner: 'Fatima Sheikh',
    propertyType: 'Residential · 3BHK',
    areaSqM: 128,
    legalStatus: 'Mortgaged · Canara Bank',
    matchConfidence: 0.93,
  },
  {
    id: 'l2',
    level: 2,
    label: 'Second floor',
    short: 'F2',
    ulpin: '3D-IND-560012-B2-L2-201',
    owner: 'Rajesh Menon',
    propertyType: 'Residential · 3BHK',
    areaSqM: 128,
    legalStatus: 'Freehold · registered',
    matchConfidence: 0.9,
  },
  {
    id: 'l1',
    level: 1,
    label: 'First floor',
    short: 'F1',
    ulpin: '3D-IND-560012-B2-L1-101',
    owner: 'Ananya Krishnan',
    propertyType: 'Residential · 2BHK',
    areaSqM: 112,
    legalStatus: 'Freehold · registered',
    matchConfidence: 0.89,
  },
  {
    id: 'l0',
    level: 0,
    label: 'Ground level',
    short: 'G',
    ulpin: '3D-IND-560012-B2-L0-P01',
    owner: "Residents' Welfare Association",
    propertyType: 'Common area · stilt parking',
    areaSqM: 168,
    legalStatus: 'Common property · undivided share',
    matchConfidence: 0.88,
  },
]

/** Same threshold the scanner used before, kept for the verdict banner. */
export const VERIFY_THRESHOLD = 0.8
