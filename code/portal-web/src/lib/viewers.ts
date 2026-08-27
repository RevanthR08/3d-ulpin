/** Canonical 3D twin URLs for the VERTICA portal. */

export const VIEWERS = {
  /** Primary city twin — Intel City (Blender DBSCAN registry). */
  intelCity: '/viewer3d/intel_city.html',
  /** Legacy society city-block demo (Tower Alpha / Gamma etc.). */
  societyBlock: '/viewer3d/',
  /** Chennai T. Nagar GLB (operator QA). */
  chennai: '/viewer3d/chennai.html',
} as const

export type CitizenTwinOpts = {
  interior?: boolean
  ug?: boolean
}

export type AdminTwinOpts = {
  ulpin?: string | null
  ug?: boolean
  qa?: 'society' | 'chennai'
}

/**
 * Citizen POV: locked to one ULPIN — orbit/zoom on their house only,
 * other buildings hidden (`mode=citizen` in the twin).
 */
export function citizenTwinHref(ulpin?: string | null, opts?: CitizenTwinOpts): string {
  const params = new URLSearchParams()
  params.set('mode', 'citizen')
  if (ulpin) params.set('ulpin', ulpin)
  if (opts?.interior) params.set('interior', '1')
  if (opts?.ug) params.set('ug', '1')
  return `${VIEWERS.intelCity}?${params.toString()}`
}

/**
 * Operator POV: full city exploration. Optional ULPIN focus — never locks.
 */
export function adminTwinHref(opts?: AdminTwinOpts): string {
  if (opts?.qa === 'society') return VIEWERS.societyBlock
  if (opts?.qa === 'chennai') return VIEWERS.chennai
  const params = new URLSearchParams()
  if (opts?.ulpin) params.set('ulpin', opts.ulpin)
  if (opts?.ug) params.set('ug', '1')
  const q = params.toString()
  return q ? `${VIEWERS.intelCity}?${q}` : VIEWERS.intelCity
}
