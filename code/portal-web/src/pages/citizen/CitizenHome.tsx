import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type IntelCityRegistry } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { getSelectedUlpin } from '../../lib/storage'

export function CitizenHome() {
  const { auth, selectedUlpin, selectUlpin } = useAuth()
  const [city, setCity] = useState<IntelCityRegistry | null>(null)

  useEffect(() => {
    api.intelCity().then((reg) => {
      setCity(reg)
      if (!getSelectedUlpin()) {
        const firstFloor = reg.buildings?.find((b) => b.floors?.length)?.floors?.[0]
        const seed = firstFloor?.ulpin || reg.buildings?.[0]?.ulpin
        if (seed) selectUlpin(seed)
      }
    }).catch(() => {})
  }, [selectUlpin])

  const featured = selectedUlpin || city?.buildings?.[0]?.floors?.[0]?.ulpin || city?.buildings?.[0]?.ulpin
  const featuredBldg = city?.buildings?.find(
    (b) => b.ulpin === featured || b.floors?.some((f) => f.ulpin === featured),
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
          Welcome{auth?.username ? `, ${auth.username}` : ''}. Inspect cadastral identity,
          ownership status, and the Intel City 3D twin for your registered volume.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white p-6 shadow-xl">
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Featured ULPIN · Intel City</div>
          <div className="font-mono mt-2 text-[18px] font-medium text-signal break-all">
            {featured || '—'}
          </div>
          {featuredBldg && (
            <div className="mt-2 text-[13px] text-mute">
              {featuredBldg.name} · {featuredBldg.kind}
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
              to="/app/map"
              className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold"
            >
              Parcel map
            </Link>
            <Link
              to="/app/polygons"
              className="rounded-xl border border-signal/30 bg-signal-soft px-4 py-2.5 text-[13px] font-semibold text-signal-deep"
            >
              3D Property Viewer
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
