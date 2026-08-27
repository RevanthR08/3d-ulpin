import { Link } from 'react-router-dom'
import type { DemoCitizenAccount } from '../lib/demoAccounts'
import { citizenTwinHref } from '../lib/viewers'
import type { UnitDetail } from '../lib/api'

export function CitizenPropertyList({
  holdings,
  details,
  variant = 'summary',
}: {
  holdings: DemoCitizenAccount[]
  details?: Record<string, UnitDetail | null>
  variant?: 'summary' | 'detail' | 'certificate' | 'record'
}) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white px-5 py-10 text-center text-[13px] text-mute">
        No properties on this citizen account.
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {holdings.map((p, i) => {
        const unit = details?.[p.ulpin]
        return (
          <li
            key={p.ulpin}
            className="rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-mute">
                  Property {i + 1} of {holdings.length}
                </div>
                <h2 className="font-display mt-1 text-[22px] font-semibold text-ink">{p.building}</h2>
                <div className="mt-1 text-[13px] text-mute">
                  {p.kind} · F{p.floor}-{p.unit} · {p.owner}
                </div>
              </div>
              <span className="rounded-full border border-signal/25 bg-signal-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-signal-deep">
                Registered
              </span>
            </div>
            <div className="font-mono mt-3 break-all text-[12px] text-signal">{p.ulpin}</div>

            {(variant === 'detail' || variant === 'record' || variant === 'certificate') && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['Owner', unit?.owner || p.owner],
                  ['Unit / floor', unit?.unit || `F${p.floor}-${p.unit}`],
                  ['Building', unit?.building_name || p.building],
                  ['Floor', unit?.floor_label != null ? String(unit.floor_label) : p.floor],
                  ['Area', unit?.area_sq_m != null ? `${unit.area_sq_m} m²` : 'On file'],
                  ['Legal status', unit?.legal_status || 'registered'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-paper px-4 py-3">
                    <div className="text-[11px] text-mute">{k}</div>
                    <div className="mt-1 text-[14px] font-semibold text-ink">{v}</div>
                  </div>
                ))}
              </div>
            )}

            {variant === 'certificate' && (
              <p className="mt-4 border-t border-line pt-4 text-[12px] leading-relaxed text-mute">
                Demonstration cadastral identity for this vertical parcel. Not a substitute for
                statutory title documents.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {variant === 'summary' && (
                <Link
                  to="/citizen/property"
                  className="text-[13px] font-semibold text-signal"
                >
                  Property details →
                </Link>
              )}
              <Link to="/citizen/ownership" className="text-[13px] font-semibold text-signal">
                Ownership →
              </Link>
              <Link to="/citizen/record" className="text-[13px] font-semibold text-mute">
                Record →
              </Link>
              <a
                href={citizenTwinHref(p.ulpin, { interior: true })}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-semibold text-mute"
              >
                Open in 3D →
              </a>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
