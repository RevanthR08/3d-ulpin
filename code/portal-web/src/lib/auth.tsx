import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuth,
  clearSelectedUlpin,
  getAuth,
  getSelectedUlpin,
  setAuth,
  setSelectedUlpin,
  type AuthState,
  type Role,
} from './storage'
import { resolveCitizenUlpin } from './demoAccounts'
import { digitsOnly, isAadhaar } from './ulpin'

type Ctx = {
  auth: AuthState | null
  login: (username: string, role: Role) => void
  logout: () => void
  selectedUlpin: string | null
  selectUlpin: (ulpin: string) => void
}

const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(() => getAuth())
  const [selectedUlpin, setUlpinState] = useState<string | null>(() => {
    const stored = getSelectedUlpin()
    const session = getAuth()
    if (session?.role === 'citizen') {
      const resolved = resolveCitizenUlpin(stored || session.username)
      if (resolved && resolved !== stored) setSelectedUlpin(resolved)
      return resolved
    }
    return stored
  })

  const login = useCallback((username: string, role: Role) => {
    const storedName = role === 'citizen' && isAadhaar(username) ? digitsOnly(username) : username.trim()
    const next = { username: storedName || username, role }
    setAuth(next)
    setAuthState(next)
    if (role === 'citizen') {
      const ulpin = resolveCitizenUlpin(storedName)
      setSelectedUlpin(ulpin)
      setUlpinState(ulpin)
    } else {
      clearSelectedUlpin()
      setUlpinState(null)
    }
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    clearSelectedUlpin()
    setAuthState(null)
    setUlpinState(null)
  }, [])

  const selectUlpin = useCallback((ulpin: string) => {
    const next = getAuth()?.role === 'citizen' ? resolveCitizenUlpin(ulpin) : ulpin
    setSelectedUlpin(next)
    setUlpinState(next)
  }, [])

  const value = useMemo(
    () => ({ auth, login, logout, selectedUlpin, selectUlpin }),
    [auth, login, logout, selectedUlpin, selectUlpin],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}
