/** Demo citizen logins — Aadhaar in, properties + 14-char ULPIN out. */

import { digitsOnly, isAadhaar, isPublicUlpin, toLegacyUlpin } from './ulpin'

export const DEFAULT_CITIZEN_AADHAAR = '345678901234'
export const DEFAULT_CITIZEN_ULPIN = '3D-IND-600001-I3-L18-U1'

export type DemoCitizenAccount = {
  aadhaar: string
  username: string
  ulpin: string
  building: string
  kind: string
  floor: string
  unit: string
  owner: string
}

/**
 * Demo Aadhaar → house(s). Restricted to Horizon Tower, Meridian Peak,
 * Cedar Walk — upper storeys so the twin camera opens on their floor.
 */
export const DEMO_CITIZEN_ACCOUNTS: DemoCitizenAccount[] = [
  {
    aadhaar: '234567890123',
    username: '234567890123',
    ulpin: '3D-IND-600001-I2-L22-U1',
    building: 'Horizon Tower',
    kind: 'skyscraper',
    floor: '22',
    unit: 'A',
    owner: 'Meera Iyer',
  },
  {
    aadhaar: '234567890123',
    username: '234567890123',
    ulpin: '3D-IND-600001-I2-L21-U1',
    building: 'Horizon Tower',
    kind: 'skyscraper',
    floor: '21',
    unit: 'A',
    owner: 'Meera Iyer',
  },
  {
    aadhaar: DEFAULT_CITIZEN_AADHAAR,
    username: DEFAULT_CITIZEN_AADHAAR,
    ulpin: DEFAULT_CITIZEN_ULPIN,
    building: 'Meridian Peak',
    kind: 'skyscraper',
    floor: '18',
    unit: 'A',
    owner: 'Harsh Vardhan',
  },
  {
    aadhaar: '456789012345',
    username: '456789012345',
    ulpin: '3D-IND-600001-I14-L12-U1',
    building: 'Cedar Walk',
    kind: 'midrise',
    floor: '12',
    unit: 'A',
    owner: 'Farhan Ali',
  },
]

export const DEMO_AADHAAR_CHIPS: Array<{ aadhaar: string; owner: string; label: string }> = [
  { aadhaar: '234567890123', owner: 'Meera Iyer', label: 'Meera · 0123' },
  { aadhaar: DEFAULT_CITIZEN_AADHAAR, owner: 'Harsh Vardhan', label: 'Harsh · 1234' },
  { aadhaar: '456789012345', owner: 'Farhan Ali', label: 'Farhan · 2345' },
]

/** Old lobby ULPINs still resolve to the matching upper-floor house. */
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

function firstUlpinForAadhaar(aadhaar: string): string {
  const hit = DEMO_CITIZEN_ACCOUNTS.find((a) => a.aadhaar === aadhaar)
  return hit?.ulpin || DEFAULT_CITIZEN_ULPIN
}

/** Map Aadhaar or ULPIN → a house ULPIN on this account. */
export function resolveCitizenUlpin(username: string): string {
  const raw = username.trim()
  if (isPublicUlpin(raw)) return resolveCitizenUlpin(toLegacyUlpin(raw))
  const aadhaar = digitsOnly(raw)
  if (isAadhaar(aadhaar)) return firstUlpinForAadhaar(aadhaar)
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

/** Every parcel held by this Aadhaar / ULPIN. */
export function ownedProperties(key: string): DemoCitizenAccount[] {
  const aadhaar = digitsOnly(key)
  if (isAadhaar(aadhaar)) {
    return DEMO_CITIZEN_ACCOUNTS.filter((a) => a.aadhaar === aadhaar)
  }
  const me = lookupCitizenAccount(key)
  if (!me) return []
  return DEMO_CITIZEN_ACCOUNTS.filter((a) => a.aadhaar === me.aadhaar)
}

/** Other properties held by the same owner. */
export function siblingProperties(ulpin: string): DemoCitizenAccount[] {
  const me = lookupCitizenAccount(ulpin)
  if (!me) return []
  return DEMO_CITIZEN_ACCOUNTS.filter((a) => a.owner === me.owner && a.ulpin !== me.ulpin)
}
