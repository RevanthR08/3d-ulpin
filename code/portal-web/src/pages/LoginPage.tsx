import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  HiOutlineArrowRight,
  HiOutlineIdentification,
  HiOutlineKey,
  HiOutlineShieldCheck,
  HiOutlineUserCircle,
} from 'react-icons/hi2'
import cityWide from '../assets/input_city_wide.png'
import { useAuth } from '../lib/auth'
import {
  DEFAULT_CITIZEN_ULPIN,
  DEMO_CITIZEN_ACCOUNTS,
  ownedProperties,
  resolveCitizenUlpin,
} from '../lib/demoAccounts'
import type { Role } from '../lib/storage'

const ADMIN_HOME = '/app/pipeline'

const ROLES: Array<{
  value: Role
  title: string
  sub: string
  Icon: typeof HiOutlineUserCircle
}> = [
  { value: 'citizen', title: 'Citizen Portal', sub: 'Your property & records', Icon: HiOutlineUserCircle },
  { value: 'admin', title: 'Operator Console', sub: 'Full city operations', Icon: HiOutlineShieldCheck },
]

export function LoginPage() {
  const { auth, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleParam = searchParams.get('role')
  const [role, setRole] = useState<Role>(
    roleParam === 'admin' || roleParam === 'operator' ? 'admin' : 'citizen',
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (auth) {
    return <Navigate to={auth.role === 'admin' ? ADMIN_HOME : '/citizen'} replace />
  }

  const isCitizen = role === 'citizen'

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name = username.trim() || (role === 'admin' ? 'operator' : DEFAULT_CITIZEN_ULPIN)
    login(name, role)
    navigate(role === 'admin' ? ADMIN_HOME : '/citizen')
  }

  const previewUlpin = isCitizen
    ? resolveCitizenUlpin(username || DEFAULT_CITIZEN_ULPIN)
    : null
  const previewHoldings = previewUlpin ? ownedProperties(previewUlpin) : []

  return (
    <div className="grain relative min-h-screen bg-paper lg:h-screen lg:overflow-hidden">
      <div className="flex w-full flex-col lg:h-full lg:flex-row">
        {/* Brand / illustration panel — full-bleed curved tint on the paper ground */}
        <aside className="relative hidden overflow-hidden lg:flex lg:w-[46%] lg:max-w-[860px] lg:items-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-y-24 -left-1/2 right-[5%]"
            style={{
              background: 'linear-gradient(155deg, #ebe8e0 0%, #d8f3ee 100%)',
              borderRadius: '0 46% 46% 0 / 0 50% 50% 0',
            }}
          />

          <div className="relative z-10 flex w-full max-w-[450px] flex-col gap-9 py-14 pl-12 pr-8">
            <div>
              <div className="font-display text-[26px] font-semibold tracking-tight text-ink">VERTICA</div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-mute">
                Volumetric cadastral intelligence
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[2.5rem] border border-white/60 shadow-[0_36px_90px_-32px_rgba(11,18,16,0.5)]">
                <img
                  src={cityWide}
                  alt="Aerial view of the cadastral city"
                  className="aspect-square w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-5 -right-3 rounded-2xl border border-line bg-paper/95 px-4 py-3 shadow-lg backdrop-blur">
                <div className="font-mono text-[11px] text-signal-deep">3D-IND-600001-B03-L12-U02</div>
                <div className="mt-0.5 text-[10px] text-mute">One ULPIN per volume</div>
              </div>
            </div>

            <p className="font-display text-[15px] italic leading-relaxed text-ink/70">
              Every floor, unit, air right and underground corridor — mapped as a volume and
              issued its own legal identity.
            </p>
          </div>
        </aside>

        {/* Role + credentials panel */}
        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:h-full lg:overflow-y-auto lg:px-16 xl:px-24">
          <div className="page-enter w-full max-w-[460px]">
            <div className="mb-6 lg:hidden">
              <div className="font-display text-[22px] font-semibold tracking-tight text-ink">VERTICA</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-mute">
                Volumetric cadastral intelligence
              </div>
            </div>

            <h1 className="font-display text-[30px] font-semibold tracking-tight text-ink">
              Choose a role
            </h1>
            <p className="mt-2 text-[13px] text-mute">
              Select a portal to verify your credentials.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {ROLES.map((r) => {
                const active = role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-2.5 rounded-2xl border px-4 py-4 text-center transition ${
                      active
                        ? 'border-signal bg-signal-soft/50 shadow-sm ring-1 ring-signal/25'
                        : 'border-line bg-white hover:border-signal/40 hover:bg-paper'
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        active ? 'bg-signal text-white' : 'bg-paper-dim text-mute'
                      }`}
                    >
                      <r.Icon className="h-6 w-6" />
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        active ? 'text-signal-deep' : 'text-ink'
                      }`}
                    >
                      {r.title}
                    </span>
                    <span className="text-[11px] leading-tight text-mute">{r.sub}</span>
                  </button>
                )
              })}
            </div>

            <form
              onSubmit={onSubmit}
              className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-sm"
            >
              <div className="text-[14px] font-semibold text-ink">
                {isCitizen ? 'Citizen access' : 'Operator credentials'}
              </div>
              <div className="mt-0.5 text-[12px] text-mute">
                {isCitizen
                  ? 'Sign in with your floor / unit ULPIN.'
                  : 'Access the restricted operator workspace.'}
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-mute">
                  {isCitizen ? 'Floor / unit ULPIN' : 'Operator username'}
                </span>
                <span className="relative block">
                  <HiOutlineIdentification className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-mute" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={isCitizen ? DEFAULT_CITIZEN_ULPIN : 'operator'}
                    className="font-mono w-full rounded-xl border border-line bg-paper py-3 pl-10 pr-3.5 text-[13px] text-ink outline-none placeholder:text-mute/50 focus:border-signal focus:bg-white"
                  />
                </span>
              </label>

              {isCitizen && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-mute">Demo</span>
                  {DEMO_CITIZEN_ACCOUNTS.map((a) => (
                    <button
                      key={a.ulpin}
                      type="button"
                      onClick={() => setUsername(a.ulpin)}
                      className="rounded-lg border border-line bg-paper px-2 py-1 text-[10px] font-semibold text-mute transition hover:border-signal hover:text-signal-deep"
                    >
                      {a.building} F{a.floor}
                    </button>
                  ))}
                </div>
              )}

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-mute">
                  Password
                </span>
                <span className="relative block">
                  <HiOutlineKey className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-mute" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Any password for this demo"
                    className="w-full rounded-xl border border-line bg-paper py-3 pl-10 pr-3.5 text-[14px] text-ink outline-none placeholder:text-mute/50 focus:border-signal focus:bg-white"
                  />
                </span>
              </label>

              {isCitizen && previewUlpin && (
                <div className="mt-4 rounded-xl border border-signal/25 bg-signal-soft/40 px-3.5 py-3 text-[12px] text-ink/70">
                  {previewHoldings.length}{' '}
                  {previewHoldings.length === 1 ? 'property' : 'properties'}
                  {previewHoldings[0]?.owner ? ` · ${previewHoldings[0].owner}` : ''}
                  <ul className="mt-2 space-y-1">
                    {previewHoldings.map((h) => (
                      <li key={h.ulpin} className="font-mono text-[11px] text-signal-deep">
                        {h.building} · floor {h.floor} · {h.ulpin}
                      </li>
                    ))}
                  </ul>
                  {username.trim() &&
                  resolveCitizenUlpin(username) === DEFAULT_CITIZEN_ULPIN &&
                  username.trim() !== DEFAULT_CITIZEN_ULPIN ? (
                    <span className="text-mute"> · unknown → default Meridian Peak</span>
                  ) : null}
                </div>
              )}

              <button
                type="submit"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-signal py-3.5 text-[14px] font-semibold text-white transition hover:bg-signal-deep"
              >
                {isCitizen ? 'Log in as Citizen' : 'Log in as Operator'}
                <HiOutlineArrowRight className="h-[18px] w-[18px]" />
              </button>

              <p className="mt-4 text-center text-[11px] leading-relaxed text-mute">
                {isCitizen
                  ? 'Citizen · Horizon Tower, Meridian Peak, or Cedar Walk ULPIN only'
                  : 'Operator · full City Atlas · no ULPIN focus on login'}
              </p>
            </form>

            <div className="mt-6 text-center">
              <p className="text-[11px] text-mute">
                Ministry of Rural Development · Department of Land Resources
              </p>
              <p className="mt-1 text-[10px] tracking-wide text-mute/70">
                DoLR · 3D ULPIN Generation &amp; Vertical Property Mapping
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
