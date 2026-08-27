import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  DEFAULT_CITIZEN_ULPIN,
  DEMO_CITIZEN_ACCOUNTS,
  resolveCitizenUlpin,
} from '../lib/demoAccounts'
import type { Role } from '../lib/storage'

export function LoginPage() {
  const { auth, login } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('citizen')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (auth) {
    return <Navigate to={auth.role === 'admin' ? '/app' : '/citizen'} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name =
      username.trim() ||
      (role === 'admin' ? 'operator' : DEFAULT_CITIZEN_ULPIN)
    login(name, role)
    navigate(role === 'admin' ? '/app' : '/citizen')
  }

  const previewUlpin =
    role === 'citizen' ? resolveCitizenUlpin(username || DEFAULT_CITIZEN_ULPIN) : null

  return (
    <div className="grain relative flex min-h-full items-center justify-center overflow-hidden bg-ink px-6 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(12,143,124,0.28), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 70%, rgba(196,132,29,0.12), transparent 50%), linear-gradient(165deg, #0B1210 0%, #14201c 45%, #0B1210 100%)',
        }}
      />
      <div className="page-enter relative z-10 w-full max-w-[520px]">
        <div className="mb-8 text-center">
          <div className="font-display text-[52px] font-semibold leading-none tracking-tight text-white">
            VERTICA
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-white/55">
            Volumetric cadastral intelligence for vertical property rights.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1">
            {([
              ['citizen', 'Citizen'],
              ['admin', 'Operator'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`rounded-lg py-2.5 text-[13px] font-semibold transition ${
                  role === value
                    ? 'bg-signal text-white shadow'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-white/40">
              {role === 'citizen' ? 'Username = floor ULPIN' : 'Username'}
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                role === 'admin' ? 'operator' : DEFAULT_CITIZEN_ULPIN
              }
              className="font-mono w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-signal"
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-white/40">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Any password for this demo"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-[14px] text-white outline-none placeholder:text-white/25 focus:border-signal"
            />
          </label>

          {role === 'citizen' && previewUlpin && (
            <div className="mb-5 rounded-xl border border-signal/25 bg-signal/10 px-3.5 py-3 text-[12px] text-white/70">
              House focus · <span className="font-mono text-signal">{previewUlpin}</span>
              {username.trim() &&
              resolveCitizenUlpin(username) === DEFAULT_CITIZEN_ULPIN &&
              username.trim() !== DEFAULT_CITIZEN_ULPIN ? (
                <span className="text-white/40"> · unknown → default Meridian Peak</span>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-signal py-3.5 text-[14px] font-semibold text-white transition hover:bg-signal-deep"
          >
            Enter workspace
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/35">
            {role === 'citizen'
              ? 'Citizen · paste a ULPIN below as username · Operator never preloads a house'
              : 'Operator · full City Atlas · no ULPIN focus on login'}
          </p>
        </form>

        {role === 'citizen' && (
          <div className="mt-6 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-white/40">
              Valid citizen usernames (ULPIN)
            </div>
            <ul className="space-y-1.5">
              {DEMO_CITIZEN_ACCOUNTS.map((a) => (
                <li key={a.ulpin}>
                  <button
                    type="button"
                    onClick={() => setUsername(a.ulpin)}
                    className="font-mono w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-white/65 hover:bg-white/5 hover:text-signal"
                  >
                    {a.ulpin}
                    <span className="mt-0.5 block font-sans text-[10px] text-white/35">
                      {a.building} · F{a.floor} · {a.owner}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-center text-[10px] tracking-wide text-white/25">
          DoLR · PS 26011 · 3D ULPIN Generation & Vertical Property Mapping
        </p>
      </div>
    </div>
  )
}
