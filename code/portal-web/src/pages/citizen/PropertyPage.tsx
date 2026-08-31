import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, resolveIntelCityUnit, type UnitDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ownedProperties } from '../../lib/demoAccounts'
import { toPublicUlpin } from '../../lib/ulpin'

export function PropertyPage() {
  const { selectedUlpin } = useAuth()
  const holdings = selectedUlpin ? ownedProperties(selectedUlpin) : []
  const [details, setDetails] = useState<Record<string, UnitDetail | null>>({})

  useEffect(() => {
    if (holdings.length === 0) return
    let cancelled = false
    api
      .intelCity()
      .then((reg) => {
        if (cancelled) return
        const next: Record<string, UnitDetail | null> = {}
        for (const h of holdings) next[h.ulpin] = resolveIntelCityUnit(reg, h.ulpin)
        setDetails(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUlpin])

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">My Property</h1>
        <p className="mt-2 text-[14px] text-mute">
          Occupancy — which building, floor and house you live in, and how much space you occupy.
          Title is on Ownership.
        </p>
      </div>

      <ul className="space-y-4">
        {holdings.map((p, i) => {
          const u = details[p.ulpin]
          return (
            <li key={p.ulpin} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="bg-ink px-5 py-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Occupied unit {i + 1} of {holdings.length}
                </div>
                <h2 className="font-display mt-1 text-[22px] font-semibold">{p.building}</h2>
                <div className="mt-1 text-[13px] text-white/60">
                  {(u?.building_kind || p.kind).replace(/_/g, ' ')} · Floor {p.floor} · House {p.unit}
                </div>
                <div className="font-mono mt-2 text-[12px] text-signal-soft">{toPublicUlpin(p.ulpin)}</div>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {[
                  ['Use', u?.use || 'Residential'],
                  ['Carpet', u?.carpet_sq_m != null ? `${u.carpet_sq_m} m²` : u?.area_sq_m != null ? `${u.area_sq_m} m²` : '—'],
                  ['Built-up', u?.built_up_sq_m != null ? `${u.built_up_sq_m} m²` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-paper px-4 py-3">
                    <div className="text-[11px] text-mute">{k}</div>
                    <div className="mt-1 text-[14px] font-semibold text-ink">{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 border-t border-line px-5 py-4">
                <Link
                  to={`/app/twin?ulpin=${encodeURIComponent(p.ulpin)}`}
                  className="text-[13px] font-semibold text-signal"
                >
                  Open this house in 3D →
                </Link>
                <Link to="/citizen/underground" className="text-[13px] font-semibold text-mute">
                  Service connections →
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
