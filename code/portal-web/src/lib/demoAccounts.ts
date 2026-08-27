/** Demo citizen logins = house-unit ULPINs. Owner names appear at most twice. */

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
 * Same owner on two rows = dual-property holder.
 */
export const DEMO_CITIZEN_ACCOUNTS: DemoCitizenAccount[] = [
  { username: '3D-IND-600001-I1-L1-U1', ulpin: '3D-IND-600001-I1-L1-U1', building: 'Glass Spire', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Dhruv Gupta' },
  { username: '3D-IND-600001-I19-L1-U1', ulpin: '3D-IND-600001-I19-L1-U1', building: 'Lane House', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Dhruv Gupta' },
  { username: '3D-IND-600001-I2-L1-U1', ulpin: '3D-IND-600001-I2-L1-U1', building: 'Horizon Tower', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Meera Iyer' },
  { username: '3D-IND-600001-I20-L1-U1', ulpin: '3D-IND-600001-I20-L1-U1', building: 'Studio Annex', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Meera Iyer' },
  { username: '3D-IND-600001-I3-L1-U1', ulpin: '3D-IND-600001-I3-L1-U1', building: 'Meridian Peak', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Harsh Vardhan' },
  { username: '3D-IND-600001-I16-L1-U1', ulpin: '3D-IND-600001-I16-L1-U1', building: 'Pocket Flat', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Harsh Vardhan' },
  { username: '3D-IND-600001-I4-L1-U1', ulpin: '3D-IND-600001-I4-L1-U1', building: 'Azure Column', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Ananya Krishnan' },
  { username: '3D-IND-600001-I17-L1-U1', ulpin: '3D-IND-600001-I17-L1-U1', building: 'Corner Shop Row', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Ananya Krishnan' },
  { username: '3D-IND-600001-I5-L1-U1', ulpin: '3D-IND-600001-I5-L1-U1', building: 'Skyline Hub', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Rohan Patel' },
  { username: '3D-IND-600001-I18-L1-U1', ulpin: '3D-IND-600001-I18-L1-U1', building: 'Garden Walk', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Rohan Patel' },
  { username: '3D-IND-600001-I6-L1-U1', ulpin: '3D-IND-600001-I6-L1-U1', building: 'North Needle', kind: 'skyscraper', floor: '1', unit: 'A', owner: 'Priya Nair' },
  { username: '3D-IND-600001-I21-L1-U1', ulpin: '3D-IND-600001-I21-L1-U1', building: 'Parcel Cottage', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Priya Nair' },
  { username: '3D-IND-600001-I7-L1-U1', ulpin: '3D-IND-600001-I7-L1-U1', building: 'Pearl Court', kind: 'midrise', floor: '1', unit: 'A', owner: 'Arjun Reddy' },
  { username: '3D-IND-600001-I22-L1-U1', ulpin: '3D-IND-600001-I22-L1-U1', building: 'Bazaar Lane', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Arjun Reddy' },
  { username: '3D-IND-600001-I8-L1-U1', ulpin: '3D-IND-600001-I8-L1-U1', building: 'Amber Residences', kind: 'midrise', floor: '1', unit: 'A', owner: 'Sneha Menon' },
  { username: '3D-IND-600001-I23-L1-U1', ulpin: '3D-IND-600001-I23-L1-U1', building: 'Court Villa', kind: 'lowrise', floor: '1', unit: 'A', owner: 'Sneha Menon' },
  { username: '3D-IND-600001-I9-L1-U1', ulpin: '3D-IND-600001-I9-L1-U1', building: 'Harbour Block', kind: 'midrise', floor: '1', unit: 'A', owner: 'Kabir Joshi' },
  { username: '3D-IND-600001-I10-L1-U1', ulpin: '3D-IND-600001-I10-L1-U1', building: 'Lotus Residences', kind: 'midrise', floor: '1', unit: 'A', owner: 'Kabir Joshi' },
  { username: '3D-IND-600001-I11-L1-U1', ulpin: '3D-IND-600001-I11-L1-U1', building: 'Crescent Court', kind: 'midrise', floor: '1', unit: 'A', owner: 'Divya Rao' },
  { username: '3D-IND-600001-I12-L1-U1', ulpin: '3D-IND-600001-I12-L1-U1', building: 'Maple Plaza', kind: 'midrise', floor: '1', unit: 'A', owner: 'Divya Rao' },
  { username: '3D-IND-600001-I13-L1-U1', ulpin: '3D-IND-600001-I13-L1-U1', building: 'Indigo Quarters', kind: 'midrise', floor: '1', unit: 'A', owner: 'Farhan Ali' },
  { username: '3D-IND-600001-I14-L1-U1', ulpin: '3D-IND-600001-I14-L1-U1', building: 'Cedar Walk', kind: 'midrise', floor: '1', unit: 'A', owner: 'Farhan Ali' },
]

const ULPIN_SET = new Set(DEMO_CITIZEN_ACCOUNTS.map((a) => a.ulpin))

/** Map citizen username → house ULPIN. Unknown / empty → default demo house. */
export function resolveCitizenUlpin(username: string): string {
  const raw = username.trim()
  if (!raw || raw.toLowerCase() === 'citizen') return DEFAULT_CITIZEN_ULPIN
  if (ULPIN_SET.has(raw)) return raw
  // Accept floor ULPIN without -U1 → map to house A when listed
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

/** Every parcel held by the same owner (including the login ULPIN). */
export function ownedProperties(ulpin: string): DemoCitizenAccount[] {
  const me = lookupCitizenAccount(ulpin)
  if (!me) return ulpin ? [{ username: ulpin, ulpin, building: 'Registered parcel', kind: 'unit', floor: '—', unit: '—', owner: '—' }] : []
  return DEMO_CITIZEN_ACCOUNTS.filter((a) => a.owner === me.owner)
}

/** Other properties held by the same owner (dual ownership). */
export function siblingProperties(ulpin: string): DemoCitizenAccount[] {
  const me = lookupCitizenAccount(ulpin)
  if (!me) return []
  return DEMO_CITIZEN_ACCOUNTS.filter((a) => a.owner === me.owner && a.ulpin !== ulpin)
}
