import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { ownedProperties } from '../../lib/demoAccounts'

type UgAsset = {
  id: string
  type: string
  label?: string
  depth_m?: number
  status?: string
  building_name?: string
  spaces?: number
}

const SERVICE_COPY: Record<string, string> = {
  water_pipeline: 'Household water you use in this building',
  sewer: 'Waste connection from your wet rooms',
  electrical_cable: 'Power feed to your floor',
  fiber_optic: 'Broadband / TV into your house',
  underground_parking: 'Basement parking under this building',
  basement: 'Basement volume under this plot',
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function depthTone(depth: number) {
  if (depth < 3) return 'bg-signal'
  if (depth < 6) return 'bg-amber'
  return 'bg-ink'
}

export function UndergroundPage() {
  const { selectedUlpin } = useAuth()
  const holdings = selectedUlpin ? ownedProperties(selectedUlpin) : []
  const [utilities, setUtilities] = useState<UgAsset[]>([])
  const [structures, setStructures] = useState<UgAsset[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/viewer3d/intel_city/intel_city_underground.json?v=8')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: { utilities?: UgAsset[]; structures?: UgAsset[] }) => {
        setUtilities(data.utilities || [])
        setStructures(data.structures || [])
      })
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  const byBuilding = useMemo(() => {
    return holdings.map((h) => {
      const structs = structures.filter((s) => s.building_name === h.building)
      const types = ['water_pipeline', 'sewer', 'electrical_cable', 'fiber_optic'] as const
      const connections = types.map((type) => {
        const pool = utilities.filter((u) => u.type === type)
        const pick = pool[hash(h.building + type) % Math.max(pool.length, 1)]
        return pick
          ? {
              ...pick,
              id: `${h.ulpin}-${type}`,
              depth_m: pick.depth_m,
            }
          : null
      }).filter(Boolean) as UgAsset[]
      return { holding: h, structs, connections }
    })
  }, [holdings, utilities, structures])

  const total = byBuilding.reduce((n, b) => n + b.structs.length + b.connections.length, 0)

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Your connections</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          These are the assets under and inside your building — parking, water, power, sewer, fiber.
          You use these connections every day. Depths are measured from ground level under your plot.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-[13px] text-amber">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-ink px-6 py-5 text-white">
        <div className="font-display text-[36px] font-semibold">{total || '—'}</div>
        <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">
          Connections on your {holdings.length === 1 ? 'building' : 'buildings'}
        </div>
      </div>

      {byBuilding.map(({ holding, structs, connections }) => (
        <section key={holding.ulpin}>
          <h2 className="font-display text-[20px] font-semibold text-ink">{holding.building}</h2>
          <p className="mt-1 text-[13px] text-mute">
            Floor {holding.floor} · House {holding.unit} — services that feed this unit
          </p>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
            {[...structs, ...connections].map((a, i) => {
              const depth = a.depth_m ?? 2 + i
              return (
                <li
                  key={a.id || i}
                  className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0"
                >
                  <div className={`h-10 w-1.5 rounded-full ${depthTone(depth)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-ink">
                      {a.label || a.type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[12px] text-mute">
                      {SERVICE_COPY[a.type] || 'Service connection you use'}
                      {a.spaces ? ` · ${a.spaces} parking spaces` : ''}
                      {' · '}
                      {a.status || 'active'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[13px] font-medium text-ink">{depth.toFixed(1)} m</div>
                    <div className="text-[10px] uppercase tracking-wide text-mute">depth</div>
                  </div>
                </li>
              )
            })}
            {!structs.length && !connections.length && (
              <li className="px-5 py-8 text-center text-[13px] text-mute">Loading connections…</li>
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}
