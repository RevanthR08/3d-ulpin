/** Mock enforcement docket — plot encroachment and unsanctioned extra storeys. */

export const DISPUTES_JSON = '/viewer3d/intel_city/intel_city_disputes.json?v=1'

export type DisputeStatus = 'open' | 'in_review' | 'closed'
export type DisputeSeverity = 'critical' | 'high' | 'medium' | 'low'

export type DisputeParty = {
  id: string
  name: string
  ulpin: string
  kind: string
}

export type EncroachmentCase = {
  kind: 'encroachment'
  id: string
  status: DisputeStatus
  severity: DisputeSeverity
  title: string
  ward: string
  notice: string
  filed_on: string
  area_sq_m: number
  setback_shortfall_m: number
  encroacher_id: string
  victim_id: string
  encroacher: DisputeParty
  victim: DisputeParty
  summary: string
  action: string
}

export type ExcessFloorCase = {
  kind: 'excess_floors'
  id: string
  status: DisputeStatus
  severity: DisputeSeverity
  title: string
  ward: string
  notice: string
  filed_on: string
  building_id: string
  name: string
  ulpin: string
  approved_floors: number
  built_floors: number
  extra_floors: number
  approved_height_m: number
  built_height_m: number
  summary: string
  action: string
}

export type DisputeCase = EncroachmentCase | ExcessFloorCase

export type DisputeDocket = {
  meta?: { city?: string; note?: string; agency?: string }
  encroachments: EncroachmentCase[]
  excess_floors: ExcessFloorCase[]
}

export function flattenDocket(d: DisputeDocket | null): DisputeCase[] {
  if (!d) return []
  const enc = (d.encroachments || []).map((c) => ({ ...c, kind: 'encroachment' as const }))
  const floors = (d.excess_floors || []).map((c) => ({ ...c, kind: 'excess_floors' as const }))
  return [...enc, ...floors]
}

export function caseFocusUlpin(c: DisputeCase): string {
  return c.kind === 'encroachment' ? c.encroacher.ulpin : c.ulpin
}

export async function fetchDisputeDocket(): Promise<DisputeDocket> {
  const res = await fetch(DISPUTES_JSON)
  if (!res.ok) throw new Error(`Dispute docket ${res.status}`)
  const raw = (await res.json()) as DisputeDocket
  return {
    meta: raw.meta,
    encroachments: (raw.encroachments || []).map((c) => ({ ...c, kind: 'encroachment' })),
    excess_floors: (raw.excess_floors || []).map((c) => ({ ...c, kind: 'excess_floors' })),
  }
}
