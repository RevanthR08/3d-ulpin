import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ownedProperties } from '../lib/demoAccounts'
import { useCitizenTickets } from '../lib/tickets'
import { CitizenTicketsPanel } from './CitizenTicketsPanel'

type IconProps = SVGProps<SVGSVGElement>
type NavItem = { to: string; label: string; end?: boolean; Icon: ComponentType<IconProps> }

function Glyph({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

const PipelineIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    <path d="M10.5 7h3.5a2 2 0 0 1 2 2v4.5" />
    <path d="M7 10.5V14a2 2 0 0 0 2 2h4.5" />
  </Glyph>
)

const LayersIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
    <path d="M3 12l9 4.5L21 12" />
    <path d="M3 16.5 12 21l9-4.5" />
  </Glyph>
)

const RegistryIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6 3.5h10.5a2 2 0 0 1 2 2V20H8a2 2 0 0 1-2-2V3.5Z" />
    <path d="M6 17.5a2 2 0 0 1 2-2h10.5" />
    <path d="M9.5 8h6M9.5 11h6" />
  </Glyph>
)

const GlobeIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.4 2.6 3.7 5.6 3.7 8.5S14.4 18.4 12 20.5C9.6 17.9 8.3 14.9 8.3 12S9.6 5.6 12 3.5Z" />
  </Glyph>
)

const FlagIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6 21V4" />
    <path d="M6 4.5h11.2a.6.6 0 0 1 .47.97L15.5 9l2.17 3.53a.6.6 0 0 1-.47.97H6" />
  </Glyph>
)

const HomeIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </Glyph>
)

const BuildingIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="5.5" y="3" width="13" height="18" rx="1.5" />
    <path d="M9 7h2M13 7h2M9 10.5h2M13 10.5h2M9 14h2M13 14h2" />
    <path d="M10 21v-3.5h4V21" />
  </Glyph>
)

const CubeIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z" />
    <path d="M3.5 7.5 12 12l8.5-4.5" />
    <path d="M12 12v9" />
  </Glyph>
)

const SignOutIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5" />
    <path d="M16 16.5 20.5 12 16 7.5" />
    <path d="M20.5 12H9" />
  </Glyph>
)

const ADMIN_NAV: NavItem[] = [
  { to: '/app/pipeline', label: 'Data & AI Pipeline', Icon: PipelineIcon },
  { to: '/app/underground-properties', label: 'Underground Properties', Icon: LayersIcon },
  { to: '/app/registry', label: 'Registry', Icon: RegistryIcon },
  { to: '/app/atlas', label: 'Atlas', Icon: GlobeIcon },
  { to: '/app/reports', label: 'Reports / Issues', Icon: FlagIcon },
]

const CITIZEN_NAV: NavItem[] = [
  { to: '/citizen', label: 'Home', end: true, Icon: HomeIcon },
  { to: '/citizen/property', label: 'My Property', Icon: BuildingIcon },
  { to: '/app/twin', label: '3D Atlas', Icon: CubeIcon },
  { to: '/citizen/report', label: 'Report an Issue', Icon: FlagIcon },
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
      <aside className="flex h-full w-24 flex-none flex-col border-r border-line bg-paper">
        <div className="flex flex-none items-center justify-center py-4">
          <div
            title="VERTICA"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white shadow-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]" role="img" aria-label="VERTICA">
              <path d="M12 2.75 21 7.25 12 11.75 3 7.25Z" fill="#0c8f7c" />
              <path d="M3 12 12 16.5 21 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 16.5 12 21 21 16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
            </svg>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-[62px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-center transition ${
                  isActive
                    ? 'bg-signal-soft text-signal-deep'
                    : 'text-mute hover:bg-paper-dim hover:text-ink'
                }`
              }
            >
              <item.Icon className="h-[22px] w-[22px]" />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-none flex-col items-center gap-2 border-t border-line py-3">
          <div
            title={`${auth.username} · ${roleLabel}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-dim text-[12px] font-semibold uppercase text-ink"
          >
            {auth.username.slice(0, 1)}
          </div>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            title="Sign out"
            className="flex flex-col items-center gap-1 text-mute transition hover:text-danger"
          >
            <SignOutIcon className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium leading-tight">Sign out</span>
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
