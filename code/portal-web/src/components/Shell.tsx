import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ownedProperties } from '../lib/demoAccounts'
import { useCitizenTickets } from '../lib/tickets'
import { CitizenTicketsPanel } from './CitizenTicketsPanel'

type NavItem = { to: string; label: string; end?: boolean }

const ADMIN_NAV: NavItem[] = [
  { to: '/app/ingest', label: 'Data Ingestion' },
  { to: '/app/processing', label: 'AI Pipeline' },
  { to: '/app/polygon-labels', label: '2D Polygon Labels' },
  { to: '/app/underground-properties', label: 'Underground Properties' },
  { to: '/app/registry', label: 'Registry' },
  { to: '/app/polygons', label: 'City Atlas' },
  { to: '/app/twin', label: '3D Atlas' },
  { to: '/app/reports', label: 'Reports / Issues' },
]

const CITIZEN_NAV: NavItem[] = [
  { to: '/citizen', label: 'Home', end: true },
  { to: '/citizen/property', label: 'My Property' },
  { to: '/citizen/ownership', label: 'Ownership' },
  { to: '/app/twin', label: '3D Atlas' },
  { to: '/citizen/underground', label: 'Underground' },
  { to: '/citizen/report', label: 'Report an Issue' },
]

export function Shell() {
  const { auth, logout, selectedUlpin } = useAuth()
  const navigate = useNavigate()
  if (!auth) return null

  const items = auth.role === 'admin' ? ADMIN_NAV : CITIZEN_NAV
  const roleLabel = auth.role === 'admin' ? 'Operator' : 'Citizen'
  const holdings = auth.role === 'citizen' && selectedUlpin ? ownedProperties(selectedUlpin) : []
  const contextLabel =
    auth.role === 'admin'
      ? 'Operator · full city'
      : holdings.length > 0
        ? `${holdings.length} ${holdings.length === 1 ? 'property' : 'properties'}`
        : 'Citizen session'

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside className="flex h-full w-[240px] flex-none flex-col bg-ink text-paper">
        <div className="border-b border-white/10 px-5 py-6">
          <div className="font-display text-[22px] font-semibold tracking-tight text-white">VERTICA</div>
          <div className="mt-1 text-[11px] tracking-wide text-white/45">Volumetric cadastral intelligence</div>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-[13px] transition ${
                  isActive
                    ? 'bg-signal/20 font-semibold text-signal'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          <div className="text-[12px] font-medium text-white/80">{auth.username}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-signal">{roleLabel}</div>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="mt-3 text-[12px] text-white/40 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center justify-between border-b border-line bg-paper/90 px-7 backdrop-blur">
          <div className="text-[12px] text-mute">Ministry of Rural Development · DoLR</div>
          <div className="flex items-center gap-2">
            {auth.role === 'citizen' && <CitizenTicketButton />}
            <div className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium tracking-wide text-ink">
              {contextLabel}
            </div>
          </div>
        </header>
        <main id="vertica-main" className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      {auth.role === 'citizen' && <CitizenTicketsPanel />}
    </div>
  )
}

function CitizenTicketButton() {
  const { openPanel, tickets } = useCitizenTickets()
  const openCount = tickets.filter((t) => t.status !== 'closed').length
  return (
    <button
      type="button"
      onClick={() => openPanel()}
      className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium tracking-wide text-ink hover:border-signal"
    >
      Tickets
      {openCount > 0 ? (
        <span className="ml-1.5 rounded-full bg-amber/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber">
          {openCount}
        </span>
      ) : null}
    </button>
  )
}
