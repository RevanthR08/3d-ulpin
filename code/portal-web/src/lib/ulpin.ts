/**
 * DoLR Bhu-Aadhaar style 14-character 3D ULPIN.
 *
 * TN 33 04 BBBB FF UU  — Tamil Nadu · Chennai · T. Nagar · building · floor · unit
 * KA 29 08 BBBB FF UU  — Karnataka society-block demo
 *
 * Internal registry IDs stay 3D-IND-…; this module is the public face.
 */

export function digitsOnly(s: string): string {
  return String(s || '').replace(/\D/g, '')
}

export function formatAadhaar(s: string): string {
  const d = digitsOnly(s).slice(0, 12)
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export function maskAadhaar(s: string): string {
  const d = digitsOnly(s)
  if (d.length !== 12) return '—'
  return `XXXX XXXX ${d.slice(-4)}`
}

export function isAadhaar(s: string): boolean {
  return digitsOnly(s).length === 12
}

export function isPublicUlpin(s: string): boolean {
  return /^[A-Z]{2}\d{12}$/i.test(String(s || '').trim())
}

/** 14-char ID shown to citizens, registry, and the twin. */
export function toPublicUlpin(raw?: string | null): string {
  if (!raw) return ''
  const s = raw.trim()
  if (isPublicUlpin(s)) return s.toUpperCase()

  const intel = s.match(/^3D-IND-600001-I(\d+)(?:-L(\d+))?(?:-U(\d+))?$/i)
  if (intel) {
    const b = String(Number(intel[1])).padStart(4, '0')
    const f = String(intel[2] ? Number(intel[2]) : 0).padStart(2, '0')
    const u = String(intel[3] ? Number(intel[3]) : 0).padStart(2, '0')
    return `TN3304${b}${f}${u}`
  }

  const soc = s.match(/^3D-IND-560012-([A-Z])(\d+)(?:-L(\d+))?(?:-([A-Z]?\d+))?$/i)
  if (soc) {
    const b = String(Number(soc[2])).padStart(4, '0')
    const f = String(soc[3] ? Number(soc[3]) : 0).padStart(2, '0')
    const unitRaw = (soc[4] || '0').replace(/\D/g, '') || '0'
    const u = String(Number(unitRaw.slice(-2))).padStart(2, '0')
    return `KA2908${b}${f}${u}`
  }

  return s
}

/** Map a 14-char ID back to the twin / JSON key. */
export function toLegacyUlpin(raw?: string | null): string {
  if (!raw) return ''
  const s = raw.trim().toUpperCase()
  const tn = s.match(/^TN3304(\d{4})(\d{2})(\d{2})$/)
  if (tn) {
    const b = Number(tn[1])
    const f = Number(tn[2])
    const u = Number(tn[3])
    let out = `3D-IND-600001-I${b}`
    if (f) out += `-L${f}`
    if (u) out += `-U${u}`
    return out
  }
  const ka = s.match(/^KA2908(\d{4})(\d{2})(\d{2})$/)
  if (ka) {
    const b = Number(ka[1])
    const f = Number(ka[2])
    const u = Number(ka[3])
    let out = `3D-IND-560012-A${b}`
    if (f) out += `-L${f}`
    if (u) out += `-${f}${String(u).padStart(2, '0')}`
    return out
  }
  return s
}

export function ulpinEquals(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return toPublicUlpin(a) === toPublicUlpin(b) || toLegacyUlpin(a) === toLegacyUlpin(b)
}

export function ulpinMatchesQuery(raw: string, needle: string): boolean {
  const n = needle.trim().toLowerCase()
  if (!n) return true
  const hay = `${raw} ${toPublicUlpin(raw)} ${toLegacyUlpin(raw)}`.toLowerCase()
  return hay.includes(n)
}
