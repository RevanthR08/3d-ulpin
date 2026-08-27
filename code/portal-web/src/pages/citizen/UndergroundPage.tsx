import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { citizenTwinHref } from '../../lib/viewers'

type UgAsset = {
  id?: string
  type?: string
  name?: string
  status?: string
  depth_m?: number
  depth?: { avg_m?: number }
}

export function UndergroundPage() {
  const { selectedUlpin } = useAuth()
  const [count, setCount] = useState(0)
  const [rows, setRows] = useState<UgAsset[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .underground()
      .then((data) => {
        const raw = data as {
          count?: number
          underground_infrastructure?: UgAsset[]
          assets?: UgAsset[]
        }
        const list = raw.underground_infrastructure || raw.assets || []
        setCount(raw.count ?? list.length)
        setRows(
          list.map((u, i) => ({
            ...u,
            depth_m: u.depth_m ?? u.depth?.avg_m ?? 1.2 + i * 0.4,
            name: u.name || u.type || u.id,
          })),
        )
      })
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Underground assets</h1>
        <p className="mt-2 text-[14px] text-mute">
          Subsurface utility network under Intel City — depth-coded for conflict-aware planning.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-[13px] text-amber">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-ink px-6 py-5 text-white">
        <div className="font-display text-[36px] font-semibold">{count}</div>
        <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Mapped assets</div>
      </div>

      <ul className="overflow-hidden rounded-2xl border border-line bg-white">
        {rows.map((a, i) => {
          const depth = a.depth_m ?? 1 + i
          const tone = depth < 1.5 ? 'bg-signal' : depth < 3 ? 'bg-amber' : 'bg-ink'
          return (
            <li
              key={a.id || i}
              className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0"
            >
              <div className={`h-10 w-1.5 rounded-full ${tone}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">
                  {a.name || a.type || a.id || `Asset ${i + 1}`}
                </div>
                <div className="text-[12px] text-mute">
                  {(a.type || 'utility').replace(/_/g, ' ')} · {a.status || 'recorded'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] font-medium text-ink">{depth.toFixed(1)} m</div>
                <div className="text-[10px] uppercase tracking-wide text-mute">depth</div>
              </div>
            </li>
          )
        })}
        {!rows.length && !err && (
          <li className="px-5 py-10 text-center text-[13px] text-mute">No underground assets in dataset</li>
        )}
      </ul>

      <div className="flex flex-wrap gap-4">
        <Link to="/app/twin" className="text-[13px] font-semibold text-signal">
          Open 3D Atlas →
        </Link>
        {selectedUlpin && (
          <a
            href={citizenTwinHref(selectedUlpin, { ug: true })}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-semibold text-mute"
          >
            My house · underground on ↗
          </a>
        )}
      </div>
    </div>
  )
}
