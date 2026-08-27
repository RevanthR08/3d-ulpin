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
  const [selectedUlpin, setUlpinState] = useState<string | null>(() => getSelectedUlpin())

  const login = useCallback((username: string, role: Role) => {
    const next = { username, role }
    setAuth(next)
    setAuthState(next)
    if (role === 'citizen') {
      const ulpin = resolveCitizenUlpin(username)
      setSelectedUlpin(ulpin)
      setUlpinState(ulpin)
    } else {
      // Operator: never preload a house focus — full city Atlas
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
    setSelectedUlpin(ulpin)
    setUlpinState(ulpin)
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
