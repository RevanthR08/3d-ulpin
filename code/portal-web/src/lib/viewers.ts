/** Canonical 3D twin URLs for the VERTICA portal. */

export const VIEWERS = {
  /** Primary city twin — Intel City (Blender DBSCAN registry). */
  intelCity: '/viewer3d/intel_city.html',
  /** Legacy society city-block demo (Tower Alpha / Gamma etc.). */
  societyBlock: '/viewer3d/',
  /** Chennai T. Nagar GLB (operator QA). */
  chennai: '/viewer3d/chennai.html',
} as const

/** Citizen POV: explore own vertical parcel in Intel City. */
export function citizenTwinHref(ulpin?: string | null): string {
  const base = VIEWERS.intelCity
  if (!ulpin) return base
  return `${base}?ulpin=${encodeURIComponent(ulpin)}`
}

/** Operator POV: same twin + optional focus; keep society/chennai as secondary QA. */
export function adminTwinHref(opts?: { ulpin?: string | null; qa?: 'society' | 'chennai' }): string {
  if (opts?.qa === 'society') return VIEWERS.societyBlock
  if (opts?.qa === 'chennai') return VIEWERS.chennai
  return citizenTwinHref(opts?.ulpin)
}
