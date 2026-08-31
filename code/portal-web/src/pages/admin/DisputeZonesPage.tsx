import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchDisputeDocket,
  flattenDocket,
  caseFocusUlpin,
  type DisputeCase,
  type DisputeDocket,
  type DisputeSeverity,
  type DisputeStatus,
} from '../../lib/disputeZones'

type FilterKey = 'all' | 'encroachment' | 'excess_floors'

const STATUS_LABEL: Record<DisputeStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  closed: 'Closed',
}

const SEVERITY_STYLE: Record<DisputeSeverity, string> = {
  critical: 'bg-danger/10 text-danger',
  high: 'bg-danger/10 text-danger',
  medium: 'bg-amber/15 text-amber',
  low: 'bg-mute/15 text-mute',
}

function twinHref(c: DisputeCase) {
  const params = new URLSearchParams()
  params.set('dispute', '1')
  params.set('focus', c.id)
  params.set('ulpin', caseFocusUlpin(c))
  return `/app/twin?${params.toString()}`
}

export function DisputeZonesPage() {
  const [docket, setDocket] = useState<DisputeDocket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    fetchDisputeDocket()
      .then(setDocket)
      .catch((e: Error) => setError(e.message || 'Could not load docket'))
  }, [])

  const cases = useMemo(() => flattenDocket(docket), [docket])
  const filtered = useMemo(() => {
    if (filter === 'all') return cases
    return cases.filter((c) => c.kind === filter)
  }, [cases, filter])
  const selected = useMemo(
    () => (openId ? cases.find((c) => c.id === openId) || null : null),
    [cases, openId],
  )

  const counts = useMemo(
    () => ({
      all: cases.length,
      encroachment: cases.filter((c) => c.kind === 'encroachment').length,
      excess_floors: cases.filter((c) => c.kind === 'excess_floors').length,
    }),
    [cases],
  )

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-6 px-7 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-ink">Dispute Zones</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
            Enforcement overlay for the twin: one building built into another’s plot, and crowns
            four floors above the sanctioned plan. Mock CMBDA / GCC docket — open a case, then
            inspect the red volumes in 3D Atlas.
          </p>
        </div>
        <Link
          to="/app/twin?dispute=1"
          className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          Open 3D overlay
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['all', 'All cases'],
            ['encroachment', 'Plot overlap'],
            ['excess_floors', 'Extra floors'],
          ] as Array<[FilterKey, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-2xl border px-5 py-4 text-left transition ${
              filter === key ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-signal'
            }`}
          >
            <div className="font-display text-[28px] font-semibold">{counts[key]}</div>
            <div
              className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${
                filter === key ? 'text-white/70' : 'text-mute'
              }`}
            >
              {label}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
            Docket · {filtered.length} · mock data
          </div>
          <div className="divide-y divide-line">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className={`flex w-full flex-col gap-2 px-5 py-4 text-left transition hover:bg-paper-dim ${
                  openId === c.id ? 'bg-paper-dim' : 'bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      c.kind === 'encroachment' ? 'bg-danger/10 text-danger' : 'bg-amber/15 text-amber'
                    }`}
                  >
                    {c.kind === 'encroachment' ? 'Overlap' : '+4 floors'}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${SEVERITY_STYLE[c.severity]}`}
                  >
                    {c.severity}
                  </span>
                  <span className="text-[11px] text-mute">{STATUS_LABEL[c.status]}</span>
                  <span className="font-mono ml-auto text-[11px] text-mute">{c.id}</span>
                </div>
                <div className="font-display text-[18px] font-semibold text-ink">{c.title}</div>
                <div className="text-[12px] text-mute">
                  {c.kind === 'encroachment'
                    ? `${c.encroacher.name} → ${c.victim.name} · ${c.area_sq_m} m²`
                    : `${c.name} · approved ${c.approved_floors} · built ${c.built_floors}`}
                </div>
              </button>
            ))}
            {!filtered.length && (
              <div className="px-5 py-12 text-center text-[13px] text-mute">No cases in this filter.</div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-6">
          {selected ? (
            <CaseDetail item={selected} />
          ) : (
            <p className="text-[13px] leading-relaxed text-mute">
              Select a case. Overlap files mark a building constructed inside a neighbour’s plot.
              Extra-floor files mark four storeys above the government-approved height — shown as a
              red hat on the twin.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function CaseDetail({ item: c }: { item: DisputeCase }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-mute">{c.notice}</div>
        <h2 className="font-display mt-1 text-[22px] font-semibold leading-snug text-ink">{c.title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-mute">{c.summary}</p>
      </div>
      <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-2 text-[12.5px]">
        <dt className="text-mute">Status</dt>
        <dd className="font-semibold">{STATUS_LABEL[c.status]}</dd>
        <dt className="text-mute">Ward</dt>
        <dd>{c.ward}</dd>
        <dt className="text-mute">Filed</dt>
        <dd className="font-mono">{c.filed_on}</dd>
        {c.kind === 'encroachment' ? (
          <>
            <dt className="text-mute">Built by</dt>
            <dd>
              {c.encroacher.name}
              <div className="font-mono text-[11px] text-signal">{c.encroacher.ulpin}</div>
            </dd>
            <dt className="text-mute">Into plot of</dt>
            <dd>
              {c.victim.name}
              <div className="font-mono text-[11px] text-signal">{c.victim.ulpin}</div>
            </dd>
            <dt className="text-mute">Overlap</dt>
            <dd>
              {c.area_sq_m} m² · setback short {c.setback_shortfall_m} m
            </dd>
          </>
        ) : (
          <>
            <dt className="text-mute">Building</dt>
            <dd>
              {c.name}
              <div className="font-mono text-[11px] text-signal">{c.ulpin}</div>
            </dd>
            <dt className="text-mute">Approved</dt>
            <dd>
              {c.approved_floors} floors · {c.approved_height_m} m
            </dd>
            <dt className="text-mute">As-built</dt>
            <dd>
              {c.built_floors} floors · {c.built_height_m} m
            </dd>
            <dt className="text-mute">Illegal</dt>
            <dd className="font-semibold text-danger">+{c.extra_floors} floors above OC</dd>
          </>
        )}
        <dt className="text-mute">Next</dt>
        <dd>{c.action}</dd>
      </dl>
      <Link
        to={twinHref(c)}
        className="inline-flex rounded-xl bg-danger px-4 py-2.5 text-[13px] font-semibold text-white"
      >
        Show on 3D twin
      </Link>
    </div>
  )
}
