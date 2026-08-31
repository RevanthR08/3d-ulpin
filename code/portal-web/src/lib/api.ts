import { toLegacyUlpin, ulpinEquals } from './ulpin'

export type SocietySummary = {
  meta?: { display_name?: string; name?: string; data_type?: string }
  computed_totals?: {
    total_buildings: number
    total_floors: number
    total_units: number
    total_rooms?: number
  }
  declared_totals?: {
    total_buildings?: number
    total_floors?: number
    total_units?: number
  }
  buildings: Array<{
    id: string
    name: string
    ulpin: string
    type?: string
    floor_count?: number
    unit_count?: number
  }>
  topology_validation?: {
    violation_count: number
    violations?: Array<{ type: string; message: string }>
  }
  statistics?: { registered_units?: number }
}

export type UnitDetail = {
  ulpin: string
  unit?: string | number
  owner?: string
  owner_id?: string
  building_id?: string
  building_name?: string
  building_kind?: string
  floor_label?: string | number
  area_sq_m?: number
  carpet_sq_m?: number
  built_up_sq_m?: number
  use?: string
  registered_on?: string
  deed_no?: string
  registration_office?: string
  tax_assessment?: string
  encumbrance?: string
  utilities?: string[]
  notes?: string
  previous_owners?: Array<{ name: string; from: string; to: string }>
  rooms?: Array<{ id?: string; name?: string; type?: string; area_sq_m?: number }>
  legal_status?: string
  elevations?: { base_m?: number; top_m?: number }
}

export type UndergroundResponse = {
  count?: number
  assets?: Array<{
    id?: string
    type?: string
    name?: string
    depth_m?: number
    status?: string
  }>
  features?: Array<unknown>
}

export type GeoSitePlan = {
  origin: { latitude: number; longitude: number }
  green_boundary?: Array<[number, number]>
  walkways?: Array<{ points: Array<[number, number]> }>
  roads?: Array<{ points: Array<[number, number]> }>
  parking_lots?: Array<{ polygon: Array<[number, number]> }>
  trees?: Array<[number, number]>
  buildings: Array<{
    id: string
    name: string
    ulpin: string
    block?: string
    type?: string
    polygon: Array<[number, number]>
  }>
}

/** Intel City freeze registry (served as static JSON under /viewer3d). */
export type IntelCityUnit = {
  unit_label?: string
  unit_index?: number
  ulpin: string
  owner?: string
  owner_id?: string
  legal_status?: string
  area_sq_m?: number
  use?: string
  registered_on?: string
  deed_no?: string
}

export type IntelCityFloor = {
  floor_label: string
  floor_index?: number
  ulpin: string
  owner?: string
  owner_id?: string
  unit_count?: number
  units?: IntelCityUnit[]
  registered_on?: string
  registration_office?: string
  deed_no?: string
  legal_status?: string
  area_sq_m?: number
  built_up_sq_m?: number
  carpet_sq_m?: number
  use?: string
  tax_assessment?: string
  encumbrance?: string
  utilities?: string[]
  notes?: string
  previous_owners?: Array<{ name: string; from: string; to: string }>
}

export type IntelCityBuilding = {
  id: string
  name: string
  kind: string
  ulpin: string
  mesh_names?: string[]
  floors: IntelCityFloor[]
}

export type IntelCityRegistry = {
  meta: {
    pincode?: string
    building_count?: number
    floor_count?: number
    source?: string
  }
  mesh_to_building?: Record<string, string>
  buildings: IntelCityBuilding[]
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  return r.json() as Promise<T>
}

const INTEL_CITY_JSON = '/viewer3d/intel_city/intel_city_buildings.json?v=10'

function parcelFrom(b: IntelCityBuilding, f?: IntelCityFloor, u?: IntelCityUnit, ulpin?: string): UnitDetail {
  return {
    ulpin: ulpin || u?.ulpin || f?.ulpin || b.ulpin,
    unit: u ? `F${f?.floor_label || '1'}-${u.unit_label || 'A'}` : f?.floor_label,
    owner: u?.owner || f?.owner,
    owner_id: u?.owner_id || f?.owner_id,
    building_id: b.id,
    building_name: b.name,
    building_kind: b.kind,
    floor_label: f?.floor_label,
    area_sq_m: u?.area_sq_m ?? f?.area_sq_m,
    carpet_sq_m: f?.carpet_sq_m,
    built_up_sq_m: f?.built_up_sq_m,
    use: u?.use || f?.use,
    registered_on: u?.registered_on || f?.registered_on,
    deed_no: u?.deed_no || f?.deed_no,
    registration_office: f?.registration_office,
    tax_assessment: f?.tax_assessment,
    encumbrance: f?.encumbrance,
    utilities: f?.utilities,
    notes: f?.notes,
    previous_owners: f?.previous_owners,
    legal_status: u?.legal_status || f?.legal_status || 'registered',
    rooms: [],
  }
}

/** Resolve building, floor, or house-unit ULPIN from Intel City registry. */
export function resolveIntelCityUnit(reg: IntelCityRegistry, ulpin: string): UnitDetail | null {
  const needle = ulpin.trim()
  if (!needle) return null
  const legacy = toLegacyUlpin(needle)
  for (const b of reg.buildings || []) {
    if (ulpinEquals(b.ulpin, needle) || b.ulpin === legacy) return parcelFrom(b, b.floors?.[0], b.floors?.[0]?.units?.[0], b.ulpin)
    for (const f of b.floors || []) {
      for (const u of f.units || []) {
        if (ulpinEquals(u.ulpin, needle) || u.ulpin === legacy) return parcelFrom(b, f, u, u.ulpin)
      }
      if (ulpinEquals(f.ulpin, needle) || f.ulpin === legacy) return parcelFrom(b, f, f.units?.[0], f.ulpin)
    }
  }
  return null
}

export type IntelCityHouse = {
  building: IntelCityBuilding
  floor: IntelCityFloor
  unit: IntelCityUnit
}

export function findIntelCityHouse(reg: IntelCityRegistry, ulpin: string): IntelCityHouse | null {
  const needle = ulpin.trim()
  if (!needle) return null
  const legacy = toLegacyUlpin(needle)
  for (const building of reg.buildings || []) {
    for (const floor of building.floors || []) {
      for (const unit of floor.units || []) {
        if (ulpinEquals(unit.ulpin, needle) || unit.ulpin === legacy) return { building, floor, unit }
      }
      if (ulpinEquals(floor.ulpin, needle) || floor.ulpin === legacy) {
        const unit = floor.units?.[0] || {
          ulpin: floor.ulpin,
          owner: floor.owner,
          owner_id: floor.owner_id,
          legal_status: floor.legal_status,
          area_sq_m: floor.area_sq_m,
          use: floor.use,
          registered_on: floor.registered_on,
          deed_no: floor.deed_no,
          unit_label: 'A',
        }
        return { building, floor, unit }
      }
    }
    if ((ulpinEquals(building.ulpin, needle) || building.ulpin === legacy) && building.floors?.[0]) {
      const floor = building.floors[0]
      const unit = floor.units?.[0]
      if (unit) return { building, floor, unit }
    }
  }
  return null
}

/* --- Novelty modules (see app/novelty.py) --- */

export type ArScan = {
  scan_id: string
  scanned_at: string
  match_confidence: number
  ulpin: string
  level: string
  building: { id: string; ulpin: string; name: string; type?: string; floor_count?: number }
  floor_label: string
  unit?: string | number | null
  owner: string
  legal_status?: string
  property_type?: string
  area_sq_m?: number | null
  gps: { latitude?: number; longitude?: number; elevation_amsl_m?: number; source?: string }
  overlay: {
    label: string
    sub_label: string
    corners_m: Array<[number, number, number]>
    height_m?: number
  }
}

export type DisputeStatus = 'pending_review' | 'approved' | 'rejected'

export type Dispute = {
  dispute_id: string
  ulpin: string
  level: string
  issue_type: string
  note: string
  status: DisputeStatus
  filed_at: string
  filed_by: string
  reviewed_at: string | null
  reviewer_note: string | null
  auto_attached: {
    building_id?: string | null
    building_ulpin?: string | null
    building_name?: string | null
    floor_label?: string | null
    unit?: string | number | null
    owner?: string | null
    property_type?: string | null
    area_sq_m?: number | null
    unit_center_m?: number[] | null
    unit_polygon_m?: Array<[number, number]> | null
    vertical_extent_m?: { base?: number | null; top?: number | null }
    gps?: { latitude?: number; longitude?: number; elevation_amsl_m?: number; source?: string }
  }
}

export type DisputeList = {
  count: number
  by_status: Record<DisputeStatus, number>
  disputes: Dispute[]
}

export const api = {
  society: () => getJson<SocietySummary>('/society'),
  geoSitePlan: () => getJson<GeoSitePlan>('/geo-site-plan'),
  unit: (ulpin: string) => getJson<UnitDetail>(`/unit/${encodeURIComponent(ulpin)}`),
  building: (id: string) => getJson<Record<string, unknown>>(`/building/${encodeURIComponent(id)}`),
  underground: () => getJson<UndergroundResponse>('/underground'),
  units: () => getJson<{ units?: UnitDetail[] }>('/units').catch(() => ({ units: [] as UnitDetail[] })),
  intelCity: () => getJson<IntelCityRegistry>(INTEL_CITY_JSON),

  arScan: () => getJson<ArScan>('/ar/scan'),
  disputes: () => getJson<DisputeList>('/disputes'),
  dispute: (id: string) => getJson<Dispute>(`/dispute/${encodeURIComponent(id)}`),
  reviewDispute: (id: string, action: 'approve' | 'reject', reviewer_note?: string) =>
    fetch(`/dispute/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, reviewer_note: reviewer_note ?? '' }),
    }).then((r) => {
      if (!r.ok) throw new Error(`/dispute/${id}/review → ${r.status}`)
      return r.json() as Promise<Dispute>
    }),
}
