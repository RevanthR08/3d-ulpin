import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type IntelCityBuilding } from '../../lib/api'

export function FloorUnitManagementPage() {
  const [buildings, setBuildings] = useState<IntelCityBuilding[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    api.intelCity()
      .then((reg) => {
        const rows = reg.buildings || []
        setBuildings(rows)
        setSelectedId(rows.find((b) => b.floors?.length)?.id || rows[0]?.id || null)
      })
      .catch(() => setBuildings([]))
  }, [])

  const selected = useMemo(
    () => buildings.find((b) => b.id === selectedId) || buildings[0],
    [buildings, selectedId],
  )

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Floor & Unit Management</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Manage the hierarchy Building → Floor → Unit with each object tied to a vertical
          extent and unique cadastral identity.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
            Buildings
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`block w-full border-b border-line px-5 py-4 text-left last:border-b-0 ${
                  selected?.id === b.id ? 'bg-signal-soft' : 'hover:bg-paper'
                }`}
              >
                <div className="text-[14px] font-semibold text-ink">{b.name}</div>
                <div className="mt-1 text-[12px] text-mute">
                  {b.kind} · {b.floors?.length || 0} floors
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-display text-[26px] font-semibold text-ink">{selected.name}</div>
                  <div className="font-mono mt-1 text-[12px] text-signal">{selected.ulpin}</div>
                </div>
                <div className="rounded-full bg-paper px-3 py-1 text-[12px] text-mute">
                  {selected.floors?.length || 0} vertical records
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(selected.floors || []).map((floor) => (
                  <div key={floor.ulpin} className="rounded-xl border border-line bg-paper px-4 py-3">
                    <div className="text-[13px] font-semibold text-ink">Floor {floor.floor_label}</div>
                    <div className="font-mono mt-1 break-all text-[10px] text-signal">{floor.ulpin}</div>
                    <div className="mt-2 text-[12px] text-mute">
                      {floor.owner || 'Owner pending'} · {floor.legal_status || 'registered'}
                    </div>
                  </div>
                ))}
                {!selected.floors?.length && (
                  <div className="rounded-xl border border-line bg-paper px-4 py-8 text-center text-[13px] text-mute">
                    No floor records for this body.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-[13px] text-mute">Loading floor registry…</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/underground-properties"
          className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          Map underground properties
        </Link>
        <Link
          to="/app/validation"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
        >
          Run validation
        </Link>
      </div>
    </div>
  )
}
