/** Demo citizen logins — only buildings whose interiors render cleanly. */

export const DEFAULT_CITIZEN_ULPIN = '3D-IND-600001-I3-L1-U1'

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
 * Restricted to Horizon Tower, Meridian Peak, Cedar Walk.
 */
export const DEMO_CITIZEN_ACCOUNTS: DemoCitizenAccount[] = [
  { username: '3D-IND-600001-I2-L1-U1', ulpin: '3D-IND-600001-I2-L1-U1', building: 'Horizon Tower', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Meera Iyer' },
  { username: '3D-IND-600001-I3-L1-U1', ulpin: '3D-IND-600001-I3-L1-U1', building: 'Meridian Peak', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Harsh Vardhan' },
  { username: '3D-IND-600001-I14-L1-U1', ulpin: '3D-IND-600001-I14-L1-U1', building: 'Cedar Walk', kind: 'midrise', floor: '1', unit: 'A', owner: 'Farhan Ali' },
]

const ULPIN_SET = new Set(DEMO_CITIZEN_ACCOUNTS.map((a) => a.ulpin))

export function isCitizenDemoUlpin(ulpin?: string | null): boolean {
  return !!ulpin && ULPIN_SET.has(ulpin.trim())
}

/** Map citizen username → house ULPIN. Unknown / empty → default Meridian Peak. */
export function resolveCitizenUlpin(username: string): string {
  const raw = username.trim()
  if (!raw || raw.toLowerCase() === 'citizen') return DEFAULT_CITIZEN_ULPIN
  if (ULPIN_SET.has(raw)) return raw
  const asUnit = raw.endsWith('-U1') || raw.endsWith('-U2') || raw.endsWith('-U3') ? raw : `${raw}-U1`
  if (ULPIN_SET.has(asUnit)) return asUnit
  const hit = DEMO_CITIZEN_ACCOUNTS.find(
    (a) => a.ulpin.toLowerCase() === raw.toLowerCase() || a.ulpin.toLowerCase() === asUnit.toLowerCase(),
  )
  return hit?.ulpin || DEFAULT_CITIZEN_ULPIN
}

export function lookupCitizenAccount(ulpin: string): DemoCitizenAccount | undefined {
  return DEMO_CITIZEN_ACCOUNTS.find((a) => a.ulpin === ulpin)
}

/** Every parcel held by this citizen (one house each in the 3D-ready set). */
export function ownedProperties(ulpin: string): DemoCitizenAccount[] {
  const me = lookupCitizenAccount(resolveCitizenUlpin(ulpin))
  return me ? [me] : []
}

/** Other properties held by the same owner. */
export function siblingProperties(ulpin: string): DemoCitizenAccount[] {
  const me = lookupCitizenAccount(ulpin)
  if (!me) return []
  return DEMO_CITIZEN_ACCOUNTS.filter((a) => a.owner === me.owner && a.ulpin !== ulpin)
}
