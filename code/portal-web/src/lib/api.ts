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

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  return r.json() as Promise<T>
}

export const api = {
  society: () => getJson<SocietySummary>('/society'),
  geoSitePlan: () => getJson<GeoSitePlan>('/geo-site-plan'),
  unit: (ulpin: string) => getJson<UnitDetail>(`/unit/${encodeURIComponent(ulpin)}`),
  building: (id: string) => getJson<Record<string, unknown>>(`/building/${encodeURIComponent(id)}`),
  underground: () => getJson<UndergroundResponse>('/underground'),
  units: () => getJson<{ units?: UnitDetail[] }>('/units').catch(() => ({ units: [] as UnitDetail[] })),
}
