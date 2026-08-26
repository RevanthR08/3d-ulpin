import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PipelineStrip } from '../../components/PipelineStrip'
import { api, type IntelCityRegistry } from '../../lib/api'
import { adminTwinHref, VIEWERS } from '../../lib/viewers'

export function CommandPage() {
  const [city, setCity] = useState<IntelCityRegistry | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .intelCity()
      .then(setCity)
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  const buildings = city?.buildings || []
  const name = 'Intel City'

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[34px] font-semibold tracking-tight text-ink">Command</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-mute">
          Operator pulse for {name} (pin {city?.meta?.pincode || '600001'}). Pipeline stages mirror
          DoLR vertical parcel workflows — extraction through 3D ULPIN issuance.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          Could not load Intel City registry — is the API serving /viewer3d? {err}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Buildings', city?.meta?.building_count ?? buildings.length ?? '—'],
          ['Floors', city?.meta?.floor_count ?? '—'],
          ['Source', city?.meta?.source?.replace(/_/g, ' ') ?? '—'],
          ['Pincode', city?.meta?.pincode ?? '600001'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white px-5 py-4">
            <div className="font-display text-[28px] font-semibold text-ink">{v}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">{k}</div>
          </div>
        ))}
      </div>

      <PipelineStrip active={2} />

      <div className="flex flex-wrap gap-3">
        <a
          href={adminTwinHref()}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink-soft"
        >
          Open 3D parcel viewer
        </a>
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
        <a
          href={VIEWERS.chennai}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-signal"
        >
          QA · Chennai
        </a>
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
          Registered buildings · Intel City
        </div>
        <ul className="divide-y divide-line">
          {buildings.slice(0, 12).map((b) => (
            <li key={b.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <div className="text-[14px] font-semibold text-ink">{b.name}</div>
                <div className="text-[12px] text-mute">
                  {b.kind} · {b.floors?.length || 0} floors
                </div>
              </div>
              <div className="font-mono text-[11px] text-signal">{b.ulpin}</div>
            </li>
          ))}
          {!city && !err && (
            <li className="px-5 py-8 text-[13px] text-mute">Loading Intel City registry…</li>
          )}
        </ul>
      </div>
    </div>
  )
}
