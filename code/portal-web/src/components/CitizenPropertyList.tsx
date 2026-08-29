import { Link } from 'react-router-dom'
import type { DemoCitizenAccount } from '../lib/demoAccounts'

/** Compact holdings list for citizen home only. */
export function CitizenPropertyList({ holdings }: { holdings: DemoCitizenAccount[] }) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white px-5 py-10 text-center text-[13px] text-mute">
        No properties on this citizen account.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {holdings.map((p, i) => (
        <li key={p.ulpin} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute">
            Property {i + 1} of {holdings.length}
          </div>
          <h2 className="font-display mt-1 text-[22px] font-semibold text-ink">{p.building}</h2>
          <div className="mt-1 text-[13px] text-mute">
            {p.kind} · Floor {p.floor} · House {p.unit}
          </div>
          <div className="font-mono mt-2 break-all text-[12px] text-signal">{p.ulpin}</div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/citizen/property" className="text-[13px] font-semibold text-signal">
              Occupancy →
            </Link>
            <Link to="/citizen/ownership" className="text-[13px] font-semibold text-mute">
              Title →
            </Link>
            <Link
              to={`/app/twin?ulpin=${encodeURIComponent(p.ulpin)}`}
              className="text-[13px] font-semibold text-mute"
            >
              3D →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
