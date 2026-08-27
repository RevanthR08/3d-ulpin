import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type IntelCityRegistry } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { lookupCitizenAccount, siblingProperties } from '../../lib/demoAccounts'

export function CitizenHome() {
  const { auth, selectedUlpin, selectUlpin } = useAuth()
  const [city, setCity] = useState<IntelCityRegistry | null>(null)

  useEffect(() => {
    api.intelCity().then(setCity).catch(() => {})
  }, [])

  const account = selectedUlpin ? lookupCitizenAccount(selectedUlpin) : null
  const siblings = selectedUlpin ? siblingProperties(selectedUlpin) : []
  const featuredBldg = city?.buildings?.find(
    (b) =>
      b.ulpin === selectedUlpin ||
      b.floors?.some((f) => f.ulpin === selectedUlpin) ||
      (account && b.name === account.building),
  )

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
          Welcome{auth?.username ? `, ${auth.username}` : ''}. Your login ULPIN opens a locked
          house in 3D Atlas — other buildings stay hidden.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white p-6 shadow-xl">
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Your ULPIN · house focus</div>
          <div className="font-mono mt-2 text-[18px] font-medium text-signal break-all">
            {selectedUlpin || '—'}
          </div>
          {(account || featuredBldg) && (
            <div className="mt-2 text-[13px] text-mute">
              {account?.building || featuredBldg?.name} · {account?.kind || featuredBldg?.kind}
              {account ? ` · F${account.floor} · ${account.owner}` : ''}
            </div>
          )}
          {siblings.length > 0 && (
            <div className="mt-4 rounded-xl border border-line bg-paper px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-mute">
                Also owned by {account?.owner}
              </div>
              <ul className="mt-2 space-y-2">
                {siblings.map((s) => (
                  <li key={s.ulpin} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{s.building}</div>
                      <div className="font-mono text-[11px] text-signal">{s.ulpin}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectUlpin(s.ulpin)}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-signal"
                    >
                      Switch house
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/citizen/property"
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              My Property
            </Link>
            <Link
              to="/citizen/record"
              className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold"
            >
              Property Record
            </Link>
            <Link
              to="/app/twin"
              className="rounded-xl border border-signal/30 bg-signal-soft px-4 py-2.5 text-[13px] font-semibold text-signal-deep"
            >
              Open 3D Atlas
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Buildings in city', city?.meta?.building_count ?? city?.buildings?.length ?? '—'],
            ['Vertical floors', city?.meta?.floor_count ?? '—'],
            ['Pin code', city?.meta?.pincode ?? '600001'],
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
