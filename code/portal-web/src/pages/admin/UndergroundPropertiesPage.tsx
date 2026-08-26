import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

type UndergroundAsset = {
  id?: string
  type?: string
  name?: string
  status?: string
  depth_m?: number
  depth?: { avg_m?: number }
}

export function UndergroundPropertiesPage() {
  const [rows, setRows] = useState<UndergroundAsset[]>([])

  useEffect(() => {
    api
      .underground()
      .then((data) => {
        const raw = data as {
          underground_infrastructure?: UndergroundAsset[]
          assets?: UndergroundAsset[]
        }
        setRows(raw.underground_infrastructure || raw.assets || [])
      })
      .catch(() => setRows([]))
  }, [])

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Underground Properties</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Admin layer for basements, parking, tunnels, utility corridors, pipes, and cables
          below the surface parcel.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Subsurface assets', rows.length || '—'],
          ['Conflict check', 'Depth + route validation'],
          ['Rights relation', 'Linked to parcel/body records'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white px-5 py-4">
            <div className="font-display text-[28px] font-semibold text-ink">{v}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">{k}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
          Asset register
        </div>
        <div className="divide-y divide-line">
          {rows.map((asset, i) => {
            const depth = asset.depth_m ?? asset.depth?.avg_m
            return (
              <div key={asset.id || i} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_140px_140px]">
                <div>
                  <div className="text-[14px] font-semibold text-ink">
                    {asset.name || asset.id || `Underground asset ${i + 1}`}
                  </div>
                  <div className="mt-1 text-[12px] text-mute">{(asset.type || 'utility').replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-[11px] text-mute">Depth</div>
                  <div className="font-mono text-[13px] text-ink">{depth != null ? `${depth} m` : 'mapped'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-mute">Status</div>
                  <div className="text-[13px] font-semibold text-signal">{asset.status || 'recorded'}</div>
                </div>
              </div>
            )
          })}
          {!rows.length && <div className="px-5 py-10 text-center text-[13px] text-mute">No underground assets loaded.</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/validation"
          className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          Validate spatial model
        </Link>
        <Link
          to="/app/ulpin-generation"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
        >
          Prepare ULPIN generation
        </Link>
      </div>
    </div>
  )
}
