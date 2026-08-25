import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
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
    const name = username.trim() || (role === 'admin' ? 'operator' : 'citizen')
    login(name, role)
    navigate(role === 'admin' ? '/app' : '/citizen')
  }

  return (
    <div className="grain relative flex min-h-full items-center justify-center overflow-hidden bg-ink px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(12,143,124,0.28), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 70%, rgba(196,132,29,0.12), transparent 50%), linear-gradient(165deg, #0B1210 0%, #14201c 45%, #0B1210 100%)',
        }}
      />
      <div className="page-enter relative z-10 w-full max-w-[440px]">
        <div className="mb-10 text-center">
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
              Username
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={role === 'admin' ? 'operator' : 'citizen'}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-[14px] text-white outline-none placeholder:text-white/25 focus:border-signal"
            />
          </label>
          <label className="mb-6 block">
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

          <button
            type="submit"
            className="w-full rounded-xl bg-signal py-3.5 text-[14px] font-semibold text-white transition hover:bg-signal-deep"
          >
            Enter workspace
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/35">
            Demo access · tap Citizen or Operator · any credentials accepted
          </p>
        </form>

        <p className="mt-8 text-center text-[10px] tracking-wide text-white/25">
          DoLR · PS 26011 · 3D ULPIN Generation & Vertical Property Mapping
        </p>
      </div>
    </div>
  )
}
