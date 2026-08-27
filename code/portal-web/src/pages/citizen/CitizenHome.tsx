import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CitizenPropertyList } from '../../components/CitizenPropertyList'
import { api, type IntelCityRegistry } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { lookupCitizenAccount, ownedProperties } from '../../lib/demoAccounts'

export function CitizenHome() {
  const { auth, selectedUlpin } = useAuth()
  const [city, setCity] = useState<IntelCityRegistry | null>(null)

  useEffect(() => {
    api.intelCity().then(setCity).catch(() => {})
  }, [])

  const holdings = selectedUlpin ? ownedProperties(selectedUlpin) : []
  const account = selectedUlpin ? lookupCitizenAccount(selectedUlpin) : holdings[0]
  const owner = account?.owner

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
          Your vertical properties
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/55">
          Welcome{auth?.username ? `, ${auth.username}` : ''}
          {owner ? ` · ${owner}` : ''}. Every parcel on this account is listed below.
        </p>

        <div className="mt-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Holdings</div>
              <div className="font-display mt-1 text-[28px] font-semibold text-white">
                {holdings.length} {holdings.length === 1 ? 'property' : 'properties'}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/citizen/property"
                className="rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
              >
                My Property
              </Link>
              <Link
                to="/app/twin"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Open 3D Atlas
              </Link>
            </div>
          </div>
          <CitizenPropertyList holdings={holdings} variant="summary" />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Your parcels', holdings.length],
            ['Buildings in city', city?.meta?.building_count ?? city?.buildings?.length ?? '—'],
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
