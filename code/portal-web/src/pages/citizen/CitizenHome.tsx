import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type SocietySummary } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { getSelectedUlpin } from '../../lib/storage'

export function CitizenHome() {
  const { auth, selectedUlpin, selectUlpin } = useAuth()
  const [society, setSociety] = useState<SocietySummary | null>(null)

  useEffect(() => {
    api.society().then((s) => {
      setSociety(s)
      if (!getSelectedUlpin() && s.buildings?.[0]?.ulpin) {
        selectUlpin(s.buildings[0].ulpin)
      }
    }).catch(() => {})
  }, [selectUlpin])

  const featured = selectedUlpin || society?.buildings?.[0]?.ulpin

  return (
    <div className="page-enter relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[320px]"
        style={{
          background:
            'linear-gradient(135deg, #0B1210 0%, #16332b 48%, #0C8F7C 140%)',
        }}
      />
      <div className="relative mx-auto max-w-5xl px-7 pb-12 pt-10">
        <p className="text-[12px] uppercase tracking-[0.18em] text-white/45">Citizen workspace</p>
        <h1 className="font-display mt-3 max-w-lg text-[40px] font-semibold leading-[1.1] tracking-tight text-white">
          Your vertical property
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/55">
          Welcome{auth?.username ? `, ${auth.username}` : ''}. Inspect cadastral identity,
          ownership status, and subsurface context for your registered volume.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white p-6 shadow-xl">
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Featured ULPIN</div>
          <div className="font-mono mt-2 text-[18px] font-medium text-signal break-all">
            {featured || '—'}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/citizen/property"
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Property identity
            </Link>
            <Link
              to="/citizen/ownership"
              className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold"
            >
              Ownership record
            </Link>
            <Link
              to="/app/map"
              className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold"
            >
              Parcel map
            </Link>
            <a
              href="/viewer3d/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-signal/30 bg-signal-soft px-4 py-2.5 text-[13px] font-semibold text-signal-deep"
            >
              Open 3D twin
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Buildings in society', society?.computed_totals?.total_buildings ?? society?.declared_totals?.total_buildings ?? '—'],
            ['Vertical units', society?.computed_totals?.total_units ?? society?.declared_totals?.total_units ?? '—'],
            ['Floors mapped', society?.computed_totals?.total_floors ?? society?.declared_totals?.total_floors ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-white px-5 py-4">
              <div className="font-display text-[26px] font-semibold">{v}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-mute">{k}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
