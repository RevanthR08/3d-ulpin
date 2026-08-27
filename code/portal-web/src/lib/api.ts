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
  building_id?: string
  building_name?: string
  floor_label?: string | number
  area_sq_m?: number
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

/** Resolve building, floor, or house-unit ULPIN from Intel City registry. */
export function resolveIntelCityUnit(reg: IntelCityRegistry, ulpin: string): UnitDetail | null {
  const needle = ulpin.trim()
  if (!needle) return null
  for (const b of reg.buildings || []) {
    if (b.ulpin === needle) {
      const f = b.floors?.[0]
      const u = f?.units?.[0]
      return {
        ulpin: b.ulpin,
        unit: b.kind === 'stadium' ? 'landmark' : 'building',
        owner: u?.owner || f?.owner || (b.kind === 'stadium' ? 'Public assembly' : '—'),
        building_id: b.id,
        building_name: b.name,
        floor_label: f?.floor_label ?? (b.kind === 'stadium' ? '—' : '1'),
        area_sq_m: u?.area_sq_m ?? f?.area_sq_m,
        legal_status: u?.legal_status || f?.legal_status || (b.kind === 'stadium' ? 'surface parcel' : 'registered'),
        rooms: [],
      }
    }
    for (const f of b.floors || []) {
      for (const u of f.units || []) {
        if (u.ulpin === needle) {
          return {
            ulpin: u.ulpin,
            unit: `F${f.floor_label}-${u.unit_label || 'A'}`,
            owner: u.owner,
            building_id: b.id,
            building_name: b.name,
            floor_label: f.floor_label,
            area_sq_m: u.area_sq_m ?? f.carpet_sq_m ?? f.area_sq_m,
            legal_status: u.legal_status || 'registered',
            rooms: [],
          }
        }
      }
      if (f.ulpin === needle) {
        return {
          ulpin: f.ulpin,
          unit: f.floor_label,
          owner: f.owner,
          building_id: b.id,
          building_name: b.name,
          floor_label: f.floor_label,
          area_sq_m: f.carpet_sq_m ?? f.area_sq_m,
          legal_status: f.legal_status || 'registered',
          rooms: [],
        }
      }
    }
  }
  return null
}

export const api = {
  society: () => getJson<SocietySummary>('/society'),
  geoSitePlan: () => getJson<GeoSitePlan>('/geo-site-plan'),
  unit: (ulpin: string) => getJson<UnitDetail>(`/unit/${encodeURIComponent(ulpin)}`),
  building: (id: string) => getJson<Record<string, unknown>>(`/building/${encodeURIComponent(id)}`),
  underground: () => getJson<UndergroundResponse>('/underground'),
  units: () => getJson<{ units?: UnitDetail[] }>('/units').catch(() => ({ units: [] as UnitDetail[] })),
  intelCity: () => getJson<IntelCityRegistry>(INTEL_CITY_JSON),
}
