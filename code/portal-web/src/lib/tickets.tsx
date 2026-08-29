import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './auth'
import { lookupCitizenAccount, ownedProperties } from './demoAccounts'
import { getCitizenTickets, type CitizenIssue } from './storage'

type Ctx = {
  open: boolean
  highlightId: string | null
  tickets: CitizenIssue[]
  openPanel: (id?: string) => void
  closePanel: () => void
  refresh: () => void
}

const TicketsCtx = createContext<Ctx | null>(null)

export function CitizenTicketsProvider({ children }: { children: ReactNode }) {
  const { auth, selectedUlpin } = useAuth()
  const [open, setOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const tickets = useMemo(() => {
    if (auth?.role !== 'citizen' || !selectedUlpin) return []
    const holdings = ownedProperties(selectedUlpin)
    const owner = lookupCitizenAccount(selectedUlpin)?.owner
    return getCitizenTickets(
      holdings.map((h) => h.ulpin),
      owner,
    )
  }, [auth?.role, selectedUlpin, tick])

  const openPanel = useCallback((id?: string) => {
    setTick((n) => n + 1)
    setHighlightId(id || null)
    setOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setOpen(false)
  }, [])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  const value = useMemo(
    () => ({ open, highlightId, tickets, openPanel, closePanel, refresh }),
    [open, highlightId, tickets, openPanel, closePanel, refresh],
  )

  return <TicketsCtx.Provider value={value}>{children}</TicketsCtx.Provider>
}

export function useCitizenTickets() {
  const ctx = useContext(TicketsCtx)
  if (!ctx) throw new Error('useCitizenTickets outside provider')
  return ctx
}
