import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PipelineStrip } from '../../components/PipelineStrip'
import { api, type SocietySummary } from '../../lib/api'

export function CommandPage() {
  const [society, setSociety] = useState<SocietySummary | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .society()
      .then(setSociety)
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  const t = society?.computed_totals || society?.declared_totals
  const name = society?.meta?.display_name || society?.meta?.name || 'Registry'

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[34px] font-semibold tracking-tight text-ink">Command</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-mute">
          Live pulse of the volumetric registry for {name}. Pipeline stages mirror DoLR vertical
          parcel workflows — extraction through 3D ULPIN issuance.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          Could not load registry — is the API running on :8000? {err}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Buildings', t?.total_buildings ?? '—'],
          ['Floors', t?.total_floors ?? '—'],
          ['Vertical units', t?.total_units ?? '—'],
          [
            'Topology',
            society?.topology_validation?.violation_count === 0
              ? 'Clean'
              : society?.topology_validation
                ? `${society.topology_validation.violation_count} issues`
                : '—',
          ],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white px-5 py-4">
            <div className="font-display text-[28px] font-semibold text-ink">{v}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">{k}</div>
          </div>
        ))}
      </div>

      <PipelineStrip active={2} />

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/ingest"
          className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink-soft"
        >
          Ingest spatial data
        </Link>
        <Link
          to="/app/map"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-signal"
        >
          Open parcel map
        </Link>
        <Link
          to="/app/validation"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-signal"
        >
          Validation report
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
          Registered buildings
        </div>
        <ul className="divide-y divide-line">
          {(society?.buildings || []).slice(0, 8).map((b) => (
            <li key={b.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <div className="text-[14px] font-semibold text-ink">{b.name}</div>
                <div className="text-[12px] text-mute">{b.type?.replace(/_/g, ' ') || b.id}</div>
              </div>
              <div className="font-mono text-[11px] text-signal">{b.ulpin}</div>
            </li>
          ))}
          {!society && !err && (
            <li className="px-5 py-8 text-[13px] text-mute">Loading registry…</li>
          )}
        </ul>
      </div>
    </div>
  )
}
