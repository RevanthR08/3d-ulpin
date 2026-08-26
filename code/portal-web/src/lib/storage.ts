const AUTH_KEY = 'vertica_auth'
const ULPIN_KEY = 'vertica_ulpin'
const REPORTS_KEY = 'vertica_issue_reports'

export type Role = 'admin' | 'citizen'

export type AuthState = {
  username: string
  role: Role
}

export type IssueStatus = 'new' | 'in_review' | 'closed'

export type CitizenIssue = {
  id: string
  createdAt: string
  ulpin: string
  category: string
  description: string
  contact?: string
  status: IssueStatus
}

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

export function getIssueReports(): CitizenIssue[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY)
    return raw ? (JSON.parse(raw) as CitizenIssue[]) : []
  } catch {
    return []
  }
}

export function saveIssueReports(reports: CitizenIssue[]) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
}

export function addIssueReport(report: Omit<CitizenIssue, 'id' | 'createdAt' | 'status'>) {
  const next: CitizenIssue = {
    ...report,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ISS-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'new',
  }
  saveIssueReports([next, ...getIssueReports()])
  return next
}

export function updateIssueReportStatus(id: string, status: IssueStatus) {
  const reports = getIssueReports().map((r) => (r.id === id ? { ...r, status } : r))
  saveIssueReports(reports)
  return reports
}
