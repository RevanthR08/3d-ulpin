const AUTH_KEY = 'vertica_auth'
const ULPIN_KEY = 'vertica_ulpin'

export type Role = 'admin' | 'citizen'

export type AuthState = {
  username: string
  role: Role
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
