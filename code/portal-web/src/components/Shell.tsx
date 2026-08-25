import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

type NavItem = { to: string; label: string; end?: boolean }

const ADMIN_NAV: NavItem[] = [
  { to: '/app', label: 'Command', end: true },
  { to: '/app/ingest', label: 'Ingestion' },
  { to: '/app/processing', label: 'AI Pipeline' },
  { to: '/app/validation', label: 'Validation' },
  { to: '/app/registry', label: 'Registry' },
  { to: '/app/polygons', label: 'Polygon viewer' },
  { to: '/app/map', label: 'Parcel Map' },
]

const CITIZEN_NAV: NavItem[] = [
  { to: '/citizen', label: 'Home', end: true },
  { to: '/citizen/property', label: 'My Property' },
  { to: '/citizen/ownership', label: 'Ownership' },
  { to: '/citizen/underground', label: 'Underground' },
  { to: '/app/polygons', label: 'Polygon viewer' },
  { to: '/app/map', label: 'Parcel Map' },
  { to: '/app/registry', label: 'Registry' },
]

export function Shell() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  if (!auth) return null

  const items = auth.role === 'admin' ? ADMIN_NAV : CITIZEN_NAV
  const roleLabel = auth.role === 'admin' ? 'Operator' : 'Citizen'

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside className="flex h-full w-[240px] flex-none flex-col bg-ink text-paper">
        <div className="border-b border-white/10 px-5 py-6">
          <div className="font-display text-[22px] font-semibold tracking-tight text-white">VERTICA</div>
          <div className="mt-1 text-[11px] tracking-wide text-white/45">Volumetric cadastral intelligence</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
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
          <a
            href="/viewer3d/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-lg px-3 py-2.5 text-[13px] text-white/40 hover:bg-white/5 hover:text-white"
          >
            Open 3D Twin ↗
          </a>
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
          <div className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium tracking-wide text-ink">
            {roleLabel} session
          </div>
        </header>
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
