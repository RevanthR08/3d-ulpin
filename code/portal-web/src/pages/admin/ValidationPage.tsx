import { useEffect, useState } from 'react'
import { api, type SocietySummary } from '../../lib/api'

export function ValidationPage() {
  const [society, setSociety] = useState<SocietySummary | null>(null)

  useEffect(() => {
    api.society().then(setSociety).catch(() => setSociety(null))
  }, [])

  const v = society?.topology_validation
  const clean = v?.violation_count === 0

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Spatial validation</h1>
        <p className="mt-2 text-[14px] text-mute">
          Intelligent topology validation across buildings, floors, and vertical units.
        </p>
      </div>

      <div
        className={`rounded-2xl border px-6 py-8 ${
          clean ? 'border-ok/25 bg-ok/5' : 'border-amber/30 bg-amber/5'
        }`}
      >
        <div className={`font-display text-[48px] font-semibold ${clean ? 'text-ok' : 'text-amber'}`}>
          {v ? (clean ? 'Clear' : v.violation_count) : '—'}
        </div>
        <div className="mt-1 text-[14px] text-mute">
          {v
            ? clean
              ? 'No topology violations in the loaded society model'
              : 'Violations require operator review before ULPIN freeze'
            : 'Load society data to run validation summary'}
        </div>
      </div>

      {v?.violations && v.violations.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {v.violations.map((item, i) => (
            <li key={i} className="px-5 py-3.5">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-amber">
                {item.type}
              </div>
              <div className="mt-1 text-[13px] text-ink">{item.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
