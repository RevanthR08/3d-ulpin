const AUTH_KEY = 'vertica_auth'
const ULPIN_KEY = 'vertica_ulpin'
const REPORTS_KEY = 'vertica_issue_reports'
const REPORTS_SEEDED_KEY = 'vertica_issue_reports_seeded_v3'

export type Role = 'admin' | 'citizen'

export type AuthState = {
  username: string
  role: Role
}

export type IssueStatus = 'new' | 'in_review' | 'closed'

export type DisputeMessage = {
  id: string
  at: string
  from: 'admin' | 'citizen' | 'system'
  channel: 'mail' | 'chat' | 'note'
  subject?: string
  body: string
}

export type CitizenIssue = {
  id: string
  createdAt: string
  ulpin: string
  category: string
  description: string
  contact?: string
  status: IssueStatus
  citizenName?: string
  citizenEmail?: string
  building?: string
  ward?: string
  priority?: 'low' | 'medium' | 'high'
  assignedTo?: string
  evidenceNote?: string
  adminSummary?: string
  messages?: DisputeMessage[]
  seeded?: boolean
}

/** Demo disputes so Operator always sees a live review queue. */
export const SEED_ISSUE_REPORTS: CitizenIssue[] = [
  {
    id: 'DSP-2026-0812',
    createdAt: '2026-08-12T09:40:00.000Z',
    ulpin: '3D-IND-600001-I1-L1-U1',
    category: 'Incorrect boundary',
    description:
      'Eastern wall of Glass Spire House A overlaps the lane setback on the 2D polygon layer. Physical compound wall is 1.2 m inside the digital footprint.',
    contact: 'Dhruv Gupta · +91 98400 11221',
    status: 'new',
    citizenName: 'Dhruv Gupta',
    citizenEmail: 'dhruv.gupta@mail.in',
    building: 'Glass Spire',
    ward: 'T. Nagar · Ward 116',
    priority: 'high',
    assignedTo: 'Unassigned',
    evidenceNote: 'Citizen attached survey sketch (not stored in demo). Compare City Atlas polygon I1 vs site photo.',
    adminSummary: 'Boundary clash flagged against lane ROW. Needs DoLR surveyor verification before Registry edit.',
    messages: [
      {
        id: 'm-0812-1',
        at: '2026-08-12T09:40:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'Dispute filed · Incorrect boundary',
        body: 'Please correct the eastern setback on Glass Spire House A. Digital polygon eats into the public lane.',
      },
    ],
    seeded: true,
  },
  {
    id: 'DSP-2026-0818',
    createdAt: '2026-08-18T14:15:00.000Z',
    ulpin: '3D-IND-600001-I3-L1-U1',
    category: 'Incorrect ownership',
    description:
      'Title shows Harsh Vardhan alone, but sale deed dated 2024 lists joint ownership with spouse. Request correction before mutation.',
    contact: 'Harsh Vardhan · harsh.v@email.in',
    status: 'new',
    citizenName: 'Harsh Vardhan',
    citizenEmail: 'harsh.v@email.in',
    building: 'Meridian Peak',
    ward: 'T. Nagar · Ward 117',
    priority: 'high',
    assignedTo: 'Unassigned',
    evidenceNote: 'Sale deed Doc No. CHN/2024/88421 cited. Await scanned copy upload.',
    adminSummary: 'Ownership mutation request — hold Registry write until deed verification.',
    messages: [
      {
        id: 'm-0818-1',
        at: '2026-08-18T14:15:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'Dispute filed · Incorrect ownership',
        body: 'Meridian Peak L1-U1 should show joint owners. Current portal record is incomplete.',
      },
    ],
    seeded: true,
  },
  {
    id: 'DSP-2026-0820',
    createdAt: '2026-08-20T11:05:00.000Z',
    ulpin: '3D-IND-600001-I7-L2-U1',
    category: 'Missing floor / unit',
    description:
      'Pearl Court Floor 2 House B is occupied and taxed but missing from Registry floors tab. Neighbour unit U2 also not listed.',
    contact: 'Arjun Reddy · Ward 118',
    status: 'in_review',
    citizenName: 'Arjun Reddy',
    citizenEmail: 'arjun.reddy@citizen.in',
    building: 'Pearl Court',
    ward: 'T. Nagar · Ward 118',
    priority: 'medium',
    assignedTo: 'Operator · Floors desk',
    evidenceNote: 'Property tax receipt 2025–26 names Flat 2B. Cross-check intel_city floors for I7.',
    adminSummary: 'Likely unit enrichment gap on midrise I7. Clarification mail already sent; citizen replied with tax ID.',
    messages: [
      {
        id: 'm-0820-1',
        at: '2026-08-20T11:05:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'Missing Flat 2B on Pearl Court',
        body: 'Floor 2 House B is taxed under my name but missing in VERTICA Registry.',
      },
      {
        id: 'm-0820-2',
        at: '2026-08-21T09:12:00.000Z',
        from: 'admin',
        channel: 'mail',
        subject: 'Clarification required · DSP-2026-0820',
        body: 'Dear Arjun Reddy,\n\nWe have taken your dispute into review. Please share the property tax assessment ID and door number plate photo for Pearl Court L2.\n\n— VERTICA Operator · DoLR desk',
      },
      {
        id: 'm-0820-3',
        at: '2026-08-21T16:40:00.000Z',
        from: 'citizen',
        channel: 'chat',
        body: 'Tax ID: TN-PT-118-77421. Door plate photo uploaded to citizen portal (mock). Flat marked 2B / U2.',
      },
      {
        id: 'm-0820-4',
        at: '2026-08-22T10:05:00.000Z',
        from: 'admin',
        channel: 'chat',
        body: 'Thanks — matching against Registry floors for I7. Will notify when unit U2 is linked.',
      },
      {
        id: 'm-0820-5',
        at: '2026-08-22T18:20:00.000Z',
        from: 'citizen',
        channel: 'chat',
        body: 'Also check neighbour U3 — builder handover list shows three houses on L2.',
      },
    ],
    seeded: true,
  },
  {
    id: 'DSP-2026-0822',
    createdAt: '2026-08-22T08:30:00.000Z',
    ulpin: '3D-IND-600001-UG-WATER-M004',
    category: 'Underground asset concern',
    description:
      'Water main UG-WATER-M004 shown under our parcel easement; CMWSSB trench opened last week was outside the marked corridor. Depth on portal says 2.8 m, site crew measured ~4 m.',
    contact: 'Priya Nair · RWWA Block I6',
    status: 'in_review',
    citizenName: 'Priya Nair',
    citizenEmail: 'priya.nair@rwwa.org',
    building: 'North Needle · UG corridor',
    ward: 'T. Nagar · Ward 119',
    priority: 'high',
    assignedTo: 'Operator · UG desk',
    evidenceNote: 'Site crew GPS vs blueprint water overlay. Compare UG Properties blueprint (blue) with trench photos.',
    adminSummary: 'Corridor offset + depth mismatch. Thread with CMWSSB liaison ongoing.',
    messages: [
      {
        id: 'm-0822-1',
        at: '2026-08-22T08:30:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'UG water main not matching trench',
        body: 'CMWSSB dig is outside the blue corridor on VERTICA. Depth also differs (~4 m vs 2.8 m on portal).',
      },
      {
        id: 'm-0822-2',
        at: '2026-08-22T12:00:00.000Z',
        from: 'admin',
        channel: 'mail',
        subject: 'Re: UG water main · DSP-2026-0822',
        body: 'Dear Priya Nair,\n\nLogged against UG-WATER-M004. Please confirm trench chainage (road name + approx distance from North Needle gate) and attach crew depth log.\n\n— VERTICA Operator · Underground desk',
      },
      {
        id: 'm-0822-3',
        at: '2026-08-23T07:45:00.000Z',
        from: 'citizen',
        channel: 'chat',
        body: 'Chainage: Ring Road east, 42 m from North Needle gate. Depth log: 3.9–4.1 m. Can we get an on-site joint inspection?',
      },
      {
        id: 'm-0822-4',
        at: '2026-08-23T11:30:00.000Z',
        from: 'admin',
        channel: 'chat',
        body: 'Scheduling joint check with CMWSSB. Hold any Registry easement edit until survey returns.',
      },
      {
        id: 'm-0822-5',
        at: '2026-08-24T09:10:00.000Z',
        from: 'system',
        channel: 'note',
        body: 'Internal: opened UG Properties board + 3D Atlas cutaway for WATER-M004.',
      },
      {
        id: 'm-0822-6',
        at: '2026-08-25T15:00:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'Follow-up · inspection slot',
        body: 'RWWA can host surveyors Thu 28 Aug 10:00. Please confirm.',
      },
    ],
    seeded: true,
  },
  {
    id: 'DSP-2026-0824',
    createdAt: '2026-08-24T16:50:00.000Z',
    ulpin: '3D-IND-600001-I8-L1-U1',
    category: 'Incorrect property information',
    description:
      'Amber Residences listed as midrise with 2 houses/floor; our L1 has three registered flats. Built-up area also short by ~18 sq.m.',
    contact: 'Sneha Menon · sneha.menon@mail.com',
    status: 'new',
    citizenName: 'Sneha Menon',
    citizenEmail: 'sneha.menon@mail.com',
    building: 'Amber Residences',
    ward: 'T. Nagar · Ward 118',
    priority: 'medium',
    assignedTo: 'Unassigned',
    evidenceNote: 'Compare builder plan vs Registry unit_count for I8.',
    adminSummary: 'Area + unit-count mismatch. No clarification thread yet.',
    messages: [
      {
        id: 'm-0824-1',
        at: '2026-08-24T16:50:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'Dispute filed · Incorrect property information',
        body: 'Amber Residences L1 should show three flats; built-up area understated by ~18 m².',
      },
    ],
    seeded: true,
  },
  {
    id: 'DSP-2026-0805',
    createdAt: '2026-08-05T10:20:00.000Z',
    ulpin: '3D-IND-600001-I11-L1-U1',
    category: 'Incorrect PIN / ULPIN',
    description:
      'Physical ULPIN plate on door reads …-I11-L1-U2 but portal login only accepts U1. Request PIN rematch after AI pipeline freeze.',
    contact: 'Divya Rao',
    status: 'closed',
    citizenName: 'Divya Rao',
    citizenEmail: 'divya.rao@mail.in',
    building: 'Crescent Court',
    ward: 'T. Nagar · Ward 120',
    priority: 'low',
    assignedTo: 'Operator · ULPIN desk',
    evidenceNote: 'Resolved: plate reprint scheduled; portal alias U1↔U2 noted.',
    adminSummary: 'Closed after clarification — physical plate error; digital U1 retained as canonical.',
    messages: [
      {
        id: 'm-0805-1',
        at: '2026-08-05T10:20:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'Door plate ULPIN mismatch',
        body: 'Plate shows U2 but login works only with U1 for Crescent Court.',
      },
      {
        id: 'm-0805-2',
        at: '2026-08-06T11:00:00.000Z',
        from: 'admin',
        channel: 'mail',
        subject: 'Clarification · DSP-2026-0805',
        body: 'Dear Divya Rao,\n\nCan you confirm whether Flat U2 exists as a separate house on L1, or is the door plate a print error?\n\n— VERTICA Operator',
      },
      {
        id: 'm-0805-3',
        at: '2026-08-07T08:15:00.000Z',
        from: 'citizen',
        channel: 'chat',
        body: 'Only one house on L1 — plate was misprinted by society office. Please keep U1.',
      },
      {
        id: 'm-0805-4',
        at: '2026-08-08T14:00:00.000Z',
        from: 'admin',
        channel: 'mail',
        subject: 'Resolved · DSP-2026-0805',
        body: 'Thank you. Canonical ULPIN remains 3D-IND-600001-I11-L1-U1. Society advised to reprint plate. Dispute closed.',
      },
      {
        id: 'm-0805-5',
        at: '2026-08-08T14:01:00.000Z',
        from: 'system',
        channel: 'note',
        body: 'Status → closed',
      },
    ],
    seeded: true,
  },
  {
    id: 'DSP-2026-0801',
    createdAt: '2026-08-01T13:00:00.000Z',
    ulpin: '3D-IND-600001-I19-L1-U1',
    category: 'Other spatial/property issue',
    description:
      'Lane House basement parking marked as shared rights; we hold exclusive deed for 2 bays. Closed after Registry note linked body ULPIN.',
    contact: 'Dhruv Gupta',
    status: 'closed',
    citizenName: 'Dhruv Gupta',
    citizenEmail: 'dhruv.gupta@mail.in',
    building: 'Lane House',
    ward: 'T. Nagar · Ward 116',
    priority: 'low',
    assignedTo: 'Operator · Rights desk',
    evidenceNote: 'Deed clause 4.2 exclusive bays linked to body ULPIN.',
    adminSummary: 'Closed — underground parking rights note added in Registry.',
    messages: [
      {
        id: 'm-0801-1',
        at: '2026-08-01T13:00:00.000Z',
        from: 'citizen',
        channel: 'mail',
        subject: 'Basement parking rights',
        body: 'Exclusive deed for 2 bays — portal shows shared.',
      },
      {
        id: 'm-0801-2',
        at: '2026-08-02T10:30:00.000Z',
        from: 'admin',
        channel: 'chat',
        body: 'Linked body ULPIN and marked exclusive bays. Please confirm on Property record.',
      },
      {
        id: 'm-0801-3',
        at: '2026-08-03T09:00:00.000Z',
        from: 'citizen',
        channel: 'chat',
        body: 'Confirmed — looks correct now. Thanks.',
      },
    ],
    seeded: true,
  },
]

export function getAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as AuthState) : null
  } catch {
    return null
  }
}

export function setAuth(auth: AuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
}

export function getSelectedUlpin(): string | null {
  return localStorage.getItem(ULPIN_KEY)
}

export function setSelectedUlpin(ulpin: string) {
  localStorage.setItem(ULPIN_KEY, ulpin)
}

export function clearSelectedUlpin() {
  localStorage.removeItem(ULPIN_KEY)
}

function readStoredReports(): CitizenIssue[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY)
    return raw ? (JSON.parse(raw) as CitizenIssue[]) : []
  } catch {
    return []
  }
}

/** Merge / refresh demo disputes (keeps citizen-submitted non-seed rows). */
export function ensureSeedIssueReports(): CitizenIssue[] {
  const existing = readStoredReports()
  const seededFlag = localStorage.getItem(REPORTS_SEEDED_KEY)
  if (seededFlag === '1') {
    if (existing.length) return existing
    saveIssueReports(SEED_ISSUE_REPORTS)
    return SEED_ISSUE_REPORTS
  }
  const byId = new Map(existing.map((r) => [r.id, r]))
  for (const seed of SEED_ISSUE_REPORTS) {
    const cur = byId.get(seed.id)
    if (!cur || cur.seeded) byId.set(seed.id, seed)
  }
  const merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  saveIssueReports(merged)
  localStorage.setItem(REPORTS_SEEDED_KEY, '1')
  return merged
}

export function getIssueReports(): CitizenIssue[] {
  return ensureSeedIssueReports()
}

export function getCitizenTickets(ulpins: string[], owner?: string): CitizenIssue[] {
  const set = new Set(ulpins)
  return getIssueReports().filter(
    (r) => set.has(r.ulpin) || (owner && r.citizenName === owner),
  )
}

export function saveIssueReports(reports: CitizenIssue[]) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
}

export function addIssueReport(report: Omit<CitizenIssue, 'id' | 'createdAt' | 'status'>) {
  ensureSeedIssueReports()
  const year = new Date().getFullYear()
  const stamp = String(Date.now()).slice(-4)
  const next: CitizenIssue = {
    ...report,
    id: `DSP-${year}-${stamp}`,
    createdAt: new Date().toISOString(),
    status: 'new',
    priority: report.priority || 'medium',
    assignedTo: report.assignedTo || 'Unassigned',
    messages: [
      {
        id: `m-${Date.now()}`,
        at: new Date().toISOString(),
        from: 'citizen',
        channel: 'mail',
        subject: `Dispute filed · ${report.category}`,
        body: report.description,
      },
      ...(report.messages || []),
    ],
  }
  saveIssueReports([next, ...getIssueReports()])
  return next
}

export function updateIssueReportStatus(id: string, status: IssueStatus) {
  const reports = getIssueReports().map((r) => {
    if (r.id !== id) return r
    const note: DisputeMessage = {
      id: `sys-${Date.now()}`,
      at: new Date().toISOString(),
      from: 'system',
      channel: 'note',
      body: `Status → ${status.replace('_', ' ')}`,
    }
    return { ...r, status, messages: [...(r.messages || []), note] }
  })
  saveIssueReports(reports)
  return reports
}

/** Admin sends clarification mail to citizen (mocked delivery). */
export function sendClarificationMail(
  id: string,
  payload: { subject: string; body: string },
): CitizenIssue[] {
  const reports = getIssueReports().map((r) => {
    if (r.id !== id) return r
    const mail: DisputeMessage = {
      id: `mail-${Date.now()}`,
      at: new Date().toISOString(),
      from: 'admin',
      channel: 'mail',
      subject: payload.subject.trim() || `Clarification · ${r.id}`,
      body: payload.body.trim(),
    }
    return {
      ...r,
      status: (r.status === 'closed' ? 'closed' : 'in_review') as IssueStatus,
      assignedTo: r.assignedTo && r.assignedTo !== 'Unassigned' ? r.assignedTo : 'Operator · Clarification',
      messages: [...(r.messages || []), mail],
    }
  })
  saveIssueReports(reports)
  return reports
}

export function appendDisputeChat(id: string, body: string, from: 'admin' | 'citizen' = 'admin') {
  const reports = getIssueReports().map((r) => {
    if (r.id !== id) return r
    const msg: DisputeMessage = {
      id: `chat-${Date.now()}`,
      at: new Date().toISOString(),
      from,
      channel: 'chat',
      body: body.trim(),
    }
    return { ...r, messages: [...(r.messages || []), msg] }
  })
  saveIssueReports(reports)
  return reports
}

export function removeIssueReport(id: string) {
  const reports = getIssueReports().filter((r) => r.id !== id)
  saveIssueReports(reports)
  return reports
}
