/** Demo citizen logins — only buildings whose interiors render cleanly. */

export const DEFAULT_CITIZEN_ULPIN = '3D-IND-600001-I3-L18-U1'

export type DemoCitizenAccount = {
  username: string
  ulpin: string
  building: string
  kind: string
  floor: string
  unit: string
  owner: string
}

/**
 * Valid citizen usernames (username === unit ULPIN).
 * Restricted to Horizon Tower, Meridian Peak, Cedar Walk — upper storeys so
 * the twin camera opens on their floor, not the lobby.
 */
export const DEMO_CITIZEN_ACCOUNTS: DemoCitizenAccount[] = [
  { username: '3D-IND-600001-I2-L22-U1', ulpin: '3D-IND-600001-I2-L22-U1', building: 'Horizon Tower', kind: 'skyscraper', floor: '22', unit: 'A', owner: 'Meera Iyer' },
  { username: '3D-IND-600001-I3-L18-U1', ulpin: '3D-IND-600001-I3-L18-U1', building: 'Meridian Peak', kind: 'skyscraper', floor: '18', unit: 'A', owner: 'Harsh Vardhan' },
  { username: '3D-IND-600001-I14-L12-U1', ulpin: '3D-IND-600001-I14-L12-U1', building: 'Cedar Walk', kind: 'midrise', floor: '12', unit: 'A', owner: 'Farhan Ali' },
]

/** Old lobby ULPINs still log in to the matching upper-floor house. */
const ULPIN_ALIASES: Record<string, string> = {
  '3D-IND-600001-I2-L1-U1': '3D-IND-600001-I2-L22-U1',
  '3D-IND-600001-I3-L1-U1': '3D-IND-600001-I3-L18-U1',
  '3D-IND-600001-I14-L1-U1': '3D-IND-600001-I14-L12-U1',
}

const ULPIN_SET = new Set(DEMO_CITIZEN_ACCOUNTS.map((a) => a.ulpin))

export function isCitizenDemoUlpin(ulpin?: string | null): boolean {
  if (!ulpin) return false
  const raw = ulpin.trim()
  return ULPIN_SET.has(raw) || ULPIN_SET.has(ULPIN_ALIASES[raw] || '')
}

/** Map citizen username → house ULPIN. Unknown / empty → default Meridian Peak. */
export function resolveCitizenUlpin(username: string): string {
  const raw = username.trim()
  if (!raw || raw.toLowerCase() === 'citizen') return DEFAULT_CITIZEN_ULPIN
  const aliased = ULPIN_ALIASES[raw]
  if (aliased) return aliased
  if (ULPIN_SET.has(raw)) return raw
  const asUnit = raw.endsWith('-U1') || raw.endsWith('-U2') || raw.endsWith('-U3') ? raw : `${raw}-U1`
  const aliasedUnit = ULPIN_ALIASES[asUnit]
  if (aliasedUnit) return aliasedUnit
  if (ULPIN_SET.has(asUnit)) return asUnit
  const hit = DEMO_CITIZEN_ACCOUNTS.find(
    (a) => a.ulpin.toLowerCase() === raw.toLowerCase() || a.ulpin.toLowerCase() === asUnit.toLowerCase(),
  )
  return hit?.ulpin || DEFAULT_CITIZEN_ULPIN
}

export function lookupCitizenAccount(ulpin: string): DemoCitizenAccount | undefined {
  const resolved = resolveCitizenUlpin(ulpin)
  return DEMO_CITIZEN_ACCOUNTS.find((a) => a.ulpin === resolved)
}

/** Every parcel held by this citizen (one house each in the 3D-ready set). */
export function ownedProperties(ulpin: string): DemoCitizenAccount[] {
  const me = lookupCitizenAccount(ulpin)
  return me ? [me] : []
}

/** Other properties held by the same owner. */
export function siblingProperties(ulpin: string): DemoCitizenAccount[] {
  const me = lookupCitizenAccount(ulpin)
  if (!me) return []
  return DEMO_CITIZEN_ACCOUNTS.filter((a) => a.owner === me.owner && a.ulpin !== me.ulpin)
}
