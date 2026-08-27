import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
/** Pasted corridor overlays: blue = water, red = sewage, green = fiber */
import blueprintFiber from '../../assets/ug_blueprint_sewer.jpg'
import blueprintSewer from '../../assets/ug_blueprint_power.jpg'
import blueprintWater from '../../assets/ug_blueprint_water.jpg'

type UgType =
  | 'water_pipeline'
  | 'sewer'
  | 'electrical_cable'
  | 'fiber_optic'
  | 'underground_parking'
  | 'basement'
  | string

type RawAsset = {
  id: string
  type: UgType
  label?: string
  depth_m?: number
  status?: string
  ulpin?: string
  building_id?: string
  building_name?: string
  spaces?: number
  mesh_name?: string
}

type AdminAsset = RawAsset & {
  kind: 'utility' | 'structure'
  name: string
  deployed_by: string
  constructed_on: string
  length_m: number
  diameter_mm?: number
  maintained_by: string
  expansion_plan: string
  known_issues: string
  rights_note: string
  corridor: string
  blueprint: string | null
  blueprint_label: string
}

type FilterKey = 'all' | 'water_pipeline' | 'sewer' | 'electrical_cable' | 'fiber_optic' | 'structure'

const UG_JSON = '/viewer3d/intel_city/intel_city_underground.json?v=8'

const TYPE_META: Record<
  string,
  { title: string; agency: string; blueprint: string | null; blueprintLabel: string; color: string }
> = {
  water_pipeline: {
    title: 'Water main',
    agency: 'CMWSSB · Chennai Metro Water',
    blueprint: blueprintWater,
    blueprintLabel: 'Water corridor blueprint · blue',
    color: '#2f6fed',
  },
  sewer: {
    title: 'Sewer / drain',
    agency: 'GCC · Storm & sewerage wing',
    blueprint: blueprintSewer,
    blueprintLabel: 'Sewer network blueprint · red',
    color: '#c62828',
  },
  electrical_cable: {
    title: 'Electrical cable',
    agency: 'TANGEDCO · Underground cables',
    blueprint: null,
    blueprintLabel: 'Power corridor (inspect in 3D Atlas)',
    color: '#c47f17',
  },
  fiber_optic: {
    title: 'Fiber optic',
    agency: 'BSNL / TACTV · Digital corridor',
    blueprint: blueprintFiber,
    blueprintLabel: 'Fiber optic blueprint · green',
    color: '#1f7a3a',
  },
  underground_parking: {
    title: 'Underground parking',
    agency: 'Chennai Metropolitan Development Authority',
    blueprint: null,
    blueprintLabel: 'Basement / parking plan',
    color: '#5b6b8c',
  },
  basement: {
    title: 'Basement volume',
    agency: 'DoLR cadastral cell · T. Nagar',
    blueprint: null,
    blueprintLabel: 'Basement rights plan',
    color: '#6b736e',
  },
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function enrich(raw: RawAsset, kind: 'utility' | 'structure'): AdminAsset {
  const meta = TYPE_META[raw.type] || TYPE_META.fiber_optic
  const h = hash(raw.id)
  const year = 2008 + (h % 16)
  const month = String(1 + (h % 12)).padStart(2, '0')
  const day = String(1 + (h % 27)).padStart(2, '0')
  const length = kind === 'structure' ? 0 : 120 + (h % 880)
  const issues = [
    'Seasonal groundwater ingress near joints — monitor monsoon 2026.',
    'Adjacent trench conflict risk with proposed metro feeder.',
    'No active conflict; clearance maintained vs fiber duct.',
    'Partial siltation reported on secondary branch — flush cycle due.',
    'Load growth may require duct upsizing within 5 years.',
  ][h % 5]
  const expansion = [
    'Extend eastward loop to Block I12–I14 in FY 2027–28.',
    'Twin parallel main planned under Ring Road phase-2.',
    'No expansion; maintain current LoD1 corridor only.',
    'Add service tees for new midrise parcels (I7–I10).',
    'Coordinate with AI pipeline freeze before corridor widen.',
  ][h % 5]
  const deployers = [
    'L&T GeoInfra (EPC)',
    'ITD Cementation',
    'NCC Urban Infra',
    'State PWD · Special Projects',
    'CMWSSB in-house package',
  ]

  return {
    ...raw,
    kind,
    name: raw.label || raw.id,
    deployed_by: deployers[h % deployers.length],
    constructed_on: `${year}-${month}-${day}`,
    length_m: length,
    diameter_mm: kind === 'utility' ? 90 + (h % 710) : undefined,
    maintained_by: meta.agency,
    expansion_plan: expansion,
    known_issues: issues,
    rights_note:
      kind === 'structure'
        ? `Linked to surface body ${raw.building_name || raw.building_id || '—'} · underground rights under parent ULPIN`
        : 'Subsurface utility easement along road / parcel corridor · rights bound to city pin 600001',
    corridor: `CORRIDOR-${raw.type.split('_')[0].toUpperCase()}-${String((h % 40) + 1).padStart(2, '0')}`,
    blueprint: meta.blueprint,
    blueprint_label: meta.blueprintLabel,
    ulpin: raw.ulpin || `3D-IND-600001-UG-${raw.id}`,
    status: raw.status || 'active',
  }
}

export function UndergroundPropertiesPage() {
  const [assets, setAssets] = useState<AdminAsset[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [blueprintOpen, setBlueprintOpen] = useState(false)

  useEffect(() => {
    setBlueprintOpen(false)
  }, [selectedId])

  useEffect(() => {
    fetch(UG_JSON)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: { utilities?: RawAsset[]; structures?: RawAsset[] }) => {
        const utils = (data.utilities || []).map((a) => enrich(a, 'utility'))
        const structs = (data.structures || []).map((a) => enrich(a, 'structure'))
        // Prefer mains first for a cleaner operator board (not 400 random rows)
        const mains = utils.filter((a) => /-M\d+$/i.test(a.id) || a.id.includes('MAIN'))
        const board = [...mains.slice(0, 48), ...structs]
        setAssets(board.length ? board : [...utils.slice(0, 40), ...structs])
        const first = board[0] || utils[0] || structs[0]
        setSelectedId(first?.id || null)
      })
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return assets
    if (filter === 'structure') return assets.filter((a) => a.kind === 'structure')
    return assets.filter((a) => a.type === filter)
  }, [assets, filter])

  const selected = filtered.find((a) => a.id === selectedId) || filtered[0] || null

  useEffect(() => {
    if (selected && !filtered.some((a) => a.id === selected.id)) {
      setSelectedId(filtered[0]?.id || null)
    }
  }, [filtered, selected])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length, structure: 0 }
    for (const a of assets) {
      c[a.type] = (c[a.type] || 0) + 1
      if (a.kind === 'structure') c.structure += 1
    }
    return c
  }, [assets])

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'water_pipeline', label: 'Water' },
    { key: 'sewer', label: 'Sewer' },
    { key: 'electrical_cable', label: 'Power' },
    { key: 'fiber_optic', label: 'Fiber' },
    { key: 'structure', label: 'Parking / basement' },
  ]

  return (
    <div className="page-enter absolute inset-0 flex flex-col overflow-hidden px-4 py-3 sm:px-5">
      <div className="flex w-full flex-none flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-[22px] font-semibold text-ink">Underground Properties</h1>
            <p className="text-[12px] text-mute">
              {counts.all || 0} assets · 2.8–7.5 m cover · UG easement + body link
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  filter === f.key
                    ? 'bg-ink text-white'
                    : 'border border-line bg-white text-ink hover:border-signal'
                }`}
              >
                {f.label}
                <span className="ml-1 text-[10px] opacity-60">{counts[f.key] || 0}</span>
              </button>
            ))}
          </div>
          <Link
            to="/app/twin"
            className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            3D Atlas · UG
          </Link>
          <Link
            to="/app/registry?tab=ulpin"
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            ULPIN pattern
          </Link>
        </div>
      </div>

      {err && (
        <div className="mt-2 w-full rounded-xl border border-danger/30 bg-danger/5 px-4 py-2 text-[13px] text-danger">
          Could not load Intel City underground registry — {err}
        </div>
      )}

      <div className="mt-3 grid min-h-0 w-full flex-1 gap-3 overflow-hidden lg:grid-cols-[260px_1fr]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex-none border-b border-line px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-mute">
            Asset register · {filtered.length}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((a) => {
              const meta = TYPE_META[a.type] || TYPE_META.fiber_optic
              const active = selected?.id === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={`block w-full border-b border-line px-3 py-2.5 text-left last:border-b-0 ${
                    active ? 'bg-signal-soft' : 'hover:bg-paper'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-2 w-2 flex-none rounded-full"
                      style={{ background: meta.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{a.id}</div>
                      <div className="mt-0.5 text-[11px] text-mute">
                        {meta.title} · {a.depth_m != null ? `${a.depth_m} m` : '—'}
                      </div>
                      <div className="font-mono mt-0.5 truncate text-[10px] text-signal">{a.ulpin}</div>
                    </div>
                  </div>
                </button>
              )
            })}
            {!filtered.length && (
              <div className="px-4 py-10 text-center text-[13px] text-mute">No assets in this filter.</div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-white">
          {selected ? (
            <>
              <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h2 className="font-display text-[18px] font-semibold text-ink">{selected.id}</h2>
                    <span className="text-[11px] text-mute">
                      {(TYPE_META[selected.type] || TYPE_META.fiber_optic).title}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="font-mono mt-0.5 break-all text-left text-[11px] text-signal hover:underline"
                    onClick={() => void navigator.clipboard.writeText(selected.ulpin || '')}
                    title="Copy ULPIN"
                  >
                    {selected.ulpin}
                  </button>
                </div>
                <div className="rounded-full bg-ok/10 px-2.5 py-0.5 text-[11px] font-semibold text-ok">
                  {selected.status}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
                {selected.blueprint ? (
                  <button
                    type="button"
                    onClick={() => setBlueprintOpen(true)}
                    className="group block w-full overflow-hidden rounded-xl border border-line bg-paper text-left transition hover:border-signal"
                  >
                    <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                      <span className="text-[11px] uppercase tracking-[0.12em] text-mute">
                        {selected.blueprint_label}
                      </span>
                      <span className="text-[10px] font-semibold text-signal group-hover:underline">
                        Click to enlarge
                      </span>
                    </div>
                    <img
                      src={selected.blueprint}
                      alt={selected.blueprint_label}
                      className="mx-auto max-h-[200px] w-full object-contain bg-white"
                    />
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-line bg-paper px-4 py-5 text-[12px] text-mute">
                    {selected.blueprint_label}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {[
                    ['Depth', selected.depth_m != null ? `${selected.depth_m} m` : '—'],
                    [
                      'Length',
                      selected.length_m
                        ? `${selected.length_m} m`
                        : selected.spaces
                          ? `${selected.spaces} spaces`
                          : '—',
                    ],
                    ['Diameter', selected.diameter_mm ? `${selected.diameter_mm} mm` : '—'],
                    ['Constructed', selected.constructed_on],
                    ['Deployed by', selected.deployed_by],
                    ['Corridor', selected.corridor],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-paper px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-mute">{k}</div>
                      <div className="mt-0.5 text-[12px] font-semibold text-ink">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Maintaining body</h3>
                    <p className="mt-1 text-[13px] font-semibold text-ink">{selected.maintained_by}</p>
                  </div>
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Rights relation</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-mute">{selected.rights_note}</p>
                    {selected.building_name && (
                      <p className="mt-1 text-[12px] text-ink">
                        Linked building · <span className="font-semibold">{selected.building_name}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">
                      Known issues / future affect
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-mute">{selected.known_issues}</p>
                  </div>
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Expansion plan</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-mute">{selected.expansion_plan}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <Link
                    to="/app/twin"
                    className="rounded-xl bg-ink px-4 py-2 text-[12px] font-semibold text-white"
                  >
                    Inspect in 3D Atlas
                  </Link>
                  <Link
                    to="/app/registry"
                    className="rounded-xl border border-line bg-white px-4 py-2 text-[12px] font-semibold text-ink"
                  >
                    Open Registry
                  </Link>
                </div>
              </div>

              {blueprintOpen && selected.blueprint && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 sm:p-8"
                  role="dialog"
                  aria-modal="true"
                  aria-label={selected.blueprint_label}
                  onClick={() => setBlueprintOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setBlueprintOpen(false)
                  }}
                >
                  <div
                    className="relative flex max-h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-none items-center justify-between gap-3 border-b border-line px-4 py-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.12em] text-mute">
                          {selected.blueprint_label}
                        </div>
                        <div className="font-display text-[16px] font-semibold text-ink">{selected.id}</div>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-signal"
                        onClick={() => setBlueprintOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto bg-white p-2">
                      <img
                        src={selected.blueprint}
                        alt={selected.blueprint_label}
                        className="mx-auto max-h-[min(82vh,900px)] w-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-mute">
              Select an underground asset
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
