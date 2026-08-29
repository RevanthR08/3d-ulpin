import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type IntelCityBuilding, type IntelCityFloor, type IntelCityUnit } from '../lib/api'
import { useAuth } from '../lib/auth'

type Tab = 'buildings' | 'floors'

type HousePick = {
  building: IntelCityBuilding
  floor: IntelCityFloor
  unit: IntelCityUnit
}

function unitsOnFloor(floor: IntelCityFloor): IntelCityUnit[] {
  if (floor.units?.length) return floor.units
  return [
    {
      unit_label: 'A',
      ulpin: floor.ulpin,
      owner: floor.owner,
      owner_id: floor.owner_id,
      legal_status: floor.legal_status,
      area_sq_m: floor.area_sq_m,
      use: floor.use,
      registered_on: floor.registered_on,
      deed_no: floor.deed_no,
    },
  ]
}

function statusClass(status?: string) {
  const s = (status || '').toLowerCase()
  if (s.includes('dispute')) return 'bg-amber/15 text-amber'
  if (s.includes('mortgage')) return 'bg-signal-soft text-signal-deep'
  if (s.includes('lease')) return 'bg-paper text-mute'
  return 'bg-ok/10 text-ok'
}

function HouseDetailModal({
  pick,
  onClose,
}: {
  pick: HousePick
  onClose: () => void
}) {
  const { selectUlpin } = useAuth()
  const { building, floor, unit } = pick
  const prev = floor.previous_owners || []
  const utils = floor.utilities || []

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel-slide max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="house-detail-title"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-mute">House record</div>
            <h2 id="house-detail-title" className="font-display mt-1 text-[22px] font-semibold text-ink">
              {building.name} · F{floor.floor_label}-{unit.unit_label || 'A'}
            </h2>
            <div className="mt-1 text-[12px] text-mute">
              City → {building.name} → Floor {floor.floor_label} → House {unit.unit_label || 'A'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[12px] font-semibold text-mute hover:bg-paper hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-mute">ULPIN</div>
            <button
              type="button"
              className="font-mono mt-1 break-all text-left text-[13px] text-signal hover:underline"
              title="Click to copy"
              onClick={() => {
                void navigator.clipboard.writeText(unit.ulpin)
                selectUlpin(unit.ulpin)
              }}
            >
              {unit.ulpin}
            </button>
          </div>

          <div>
            <div className="text-[20px] font-semibold text-ink">{unit.owner || '—'}</div>
            <div className="font-mono mt-0.5 text-[11px] text-mute">{unit.owner_id || floor.owner_id || ''}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Area', unit.area_sq_m != null ? `${unit.area_sq_m} m²` : '—'],
              ['Use', unit.use || floor.use || '—'],
              ['Floor parcel', floor.area_sq_m != null ? `${floor.area_sq_m} m²` : '—'],
              ['Carpet (floor)', floor.carpet_sq_m != null ? `${floor.carpet_sq_m} m²` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-paper px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-mute">{k}</div>
                <div className="mt-0.5 text-[13px] font-semibold text-ink">{v}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Registration</h3>
            <div className="mt-2 space-y-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-mute">Status</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                    unit.legal_status || floor.legal_status,
                  )}`}
                >
                  {unit.legal_status || floor.legal_status || 'registered'}
                </span>
              </div>
              <div>
                <span className="text-mute">Registered on </span>
                <span className="font-semibold text-ink">
                  {unit.registered_on || floor.registered_on || '—'}
                </span>
              </div>
              <div>
                <span className="text-mute">Office </span>
                <span className="text-ink">{floor.registration_office || '—'}</span>
              </div>
              <div>
                <span className="text-mute">Deed </span>
                <code className="rounded bg-paper px-1.5 py-0.5 text-[12px] text-ink">
                  {unit.deed_no || floor.deed_no || '—'}
                </code>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Previous owners</h3>
            <ul className="mt-2 space-y-2">
              {prev.length ? (
                prev.map((p) => (
                  <li key={`${p.name}-${p.from}`} className="rounded-xl border border-line bg-paper px-3 py-2">
                    <div className="text-[13px] font-semibold text-ink">{p.name}</div>
                    <div className="text-[11px] text-mute">
                      {p.from} → {p.to}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-mute">No prior chain on file</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Use & assessment</h3>
            <div className="mt-2 space-y-1.5 text-[13px]">
              <div>
                <span className="text-mute">Tax </span>
                <span className="text-ink">{floor.tax_assessment || '—'}</span>
              </div>
              <div>
                <span className="text-mute">Encumbrance </span>
                <span className="text-ink">{floor.encumbrance || '—'}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Utilities</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {utils.length ? (
                utils.map((u) => (
                  <span
                    key={u}
                    className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink"
                  >
                    {u}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-mute">—</span>
              )}
            </div>
          </div>

          {floor.notes && (
            <p className="text-[12px] leading-relaxed text-mute">{floor.notes}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Link
              to="/app/twin"
              onClick={() => selectUlpin(unit.ulpin)}
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Open in 3D Atlas
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RegistryPage() {
  const { selectUlpin } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'floors' ? 'floors' : 'buildings'
  const [buildings, setBuildings] = useState<IntelCityBuilding[]>([])
  const [q, setQ] = useState(() => params.get('q') || '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [housePick, setHousePick] = useState<HousePick | null>(null)

  useEffect(() => {
    api
      .intelCity()
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

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return buildings
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        b.ulpin.toLowerCase().includes(needle) ||
        b.id.toLowerCase().includes(needle) ||
        b.kind.toLowerCase().includes(needle),
    )
  }, [buildings, q])

  const floorCount = buildings.reduce((sum, b) => sum + (b.floors?.length || 0), 0)
  const unitCount = buildings.reduce(
    (sum, b) =>
      sum +
      (b.floors || []).reduce((s, f) => s + (f.units?.length || f.unit_count || 0), 0),
    0,
  )

  function setTab(next: Tab) {
    setParams(next === 'buildings' ? {} : { tab: next })
  }

  return (
    <div className="page-enter absolute inset-0 flex flex-col overflow-hidden px-7 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-none flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold text-ink">Registry</h1>
          <p className="mt-1 max-w-xl text-[13px] text-mute">
            Buildings and floor houses — skyscraper floors hold up to 3 units with different owners.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-line bg-white">
          {(
            [
              ['buildings', 'Buildings'],
              ['floors', 'Floors & units'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-[12px] font-semibold ${
                tab === id ? 'bg-ink text-white' : 'text-ink hover:bg-paper-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-5 flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden">
        {tab === 'buildings' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex flex-none flex-wrap items-center justify-between gap-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Buildings', buildings.length],
                  ['Floors', floorCount],
                  ['Units', unitCount || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-line bg-white px-4 py-3">
                    <div className="font-display text-[22px] font-semibold text-ink">{v}</div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-mute">{k}</div>
                  </div>
                ))}
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, kind, or ULPIN"
                className="w-full max-w-xs rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] outline-none focus:border-signal"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 border-b border-line bg-paper text-[11px] uppercase tracking-[0.12em] text-mute">
                  <tr>
                    <th className="px-5 py-3 font-medium">Building</th>
                    <th className="px-5 py-3 font-medium">Kind</th>
                    <th className="px-5 py-3 font-medium">Floors</th>
                    <th className="px-5 py-3 font-medium">ULPIN</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((b) => (
                    <tr key={b.id} className="hover:bg-paper/80">
                      <td className="px-5 py-3.5 font-semibold text-ink">{b.name}</td>
                      <td className="px-5 py-3.5 text-mute">{b.kind}</td>
                      <td className="px-5 py-3.5 text-mute">{b.floors?.length ?? 0}</td>
                      <td className="font-mono px-5 py-3.5 text-[11px] text-signal">{b.ulpin}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(b.id)
                            setTab('floors')
                          }}
                          className="text-[12px] font-semibold text-ink hover:text-signal"
                        >
                          Floors
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            selectUlpin(b.floors?.[0]?.units?.[0]?.ulpin || b.floors?.[0]?.ulpin || b.ulpin)
                          }
                          className="ml-3 text-[12px] font-semibold text-mute hover:text-signal"
                        >
                          Select
                        </button>
                        <Link
                          to="/app/twin"
                          onClick={() =>
                            selectUlpin(b.floors?.[0]?.units?.[0]?.ulpin || b.floors?.[0]?.ulpin || b.ulpin)
                          }
                          className="ml-3 text-[12px] font-semibold text-mute hover:text-signal"
                        >
                          3D
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-mute">
                        No buildings match
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'floors' && (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[280px_1fr]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-white">
              <div className="flex-none border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
                Buildings
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {buildings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={`block w-full border-b border-line px-5 py-3.5 text-left last:border-b-0 ${
                      selected?.id === b.id ? 'bg-signal-soft' : 'hover:bg-paper'
                    }`}
                  >
                    <div className="text-[14px] font-semibold text-ink">{b.name}</div>
                    <div className="mt-0.5 text-[12px] text-mute">
                      {b.kind} · {b.floors?.length || 0} floors
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-white">
              {selected ? (
                <>
                  <div className="flex flex-none flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-4">
                    <div>
                      <div className="font-display text-[24px] font-semibold text-ink">{selected.name}</div>
                      <div className="font-mono mt-1 text-[12px] text-signal">{selected.ulpin}</div>
                    </div>
                    <div className="rounded-full bg-paper px-3 py-1 text-[12px] text-mute">
                      {selected.kind === 'skyscraper'
                        ? 'Up to 3 houses / floor'
                        : selected.kind === 'midrise'
                          ? 'Up to 2 houses / floor'
                          : selected.kind === 'lowrise'
                            ? '1 house / floor'
                            : 'No residential units'}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                    {(selected.floors || []).map((floor) => {
                      const units = unitsOnFloor(floor)
                      return (
                        <div key={floor.ulpin} className="rounded-xl border border-line bg-paper p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-[14px] font-semibold text-ink">
                                Floor {floor.floor_label}
                              </div>
                              <div className="font-mono mt-0.5 text-[10px] text-mute">{floor.ulpin}</div>
                            </div>
                            <div className="text-[11px] text-mute">
                              {units.length} house{units.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {units.map((u) => (
                              <button
                                key={u.ulpin}
                                type="button"
                                onClick={() => {
                                  selectUlpin(u.ulpin)
                                  setHousePick({ building: selected, floor, unit: u })
                                }}
                                className="rounded-lg border border-line bg-white px-3 py-2.5 text-left hover:border-signal"
                              >
                                <div className="text-[12px] font-semibold text-ink">
                                  House {u.unit_label || '?'}
                                </div>
                                <div className="font-mono mt-0.5 break-all text-[10px] text-signal">
                                  {u.ulpin}
                                </div>
                                <div className="mt-1.5 text-[12px] font-medium text-ink">
                                  {u.owner || '—'}
                                </div>
                                <div className="text-[11px] text-mute">
                                  {u.legal_status || 'registered'}
                                  {u.area_sq_m != null ? ` · ${u.area_sq_m} m²` : ''}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {!selected.floors?.length && (
                      <div className="rounded-xl border border-line bg-paper px-4 py-8 text-center text-[13px] text-mute">
                        No floor records for this body.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-[13px] text-mute">Loading…</div>
              )}
            </div>
          </div>
        )}
      </div>

      {housePick && <HouseDetailModal pick={housePick} onClose={() => setHousePick(null)} />}
    </div>
  )
}
