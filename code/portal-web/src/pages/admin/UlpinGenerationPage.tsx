import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type IntelCityBuilding } from '../../lib/api'

export function UlpinGenerationPage() {
  const [buildings, setBuildings] = useState<IntelCityBuilding[]>([])

  useEffect(() => {
    api.intelCity().then((reg) => setBuildings(reg.buildings || [])).catch(() => setBuildings([]))
  }, [])

  const floorCount = buildings.reduce((sum, b) => sum + (b.floors?.length || 0), 0)

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">ULPIN Generation</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Assign final PIN/ULPIN identities after geometry creation and validation. A main
          parcel can contain many bodies, and each floor/body can receive its own identity.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-ink p-6 text-white">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Pattern</div>
        <div className="font-mono mt-3 break-all text-[18px] text-signal-soft">
          3D-IND-&lt;pincode&gt;-&lt;body&gt;-L&lt;floor&gt;-&lt;unit&gt;
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Bodies ready', buildings.length],
          ['Floor PINs', floorCount],
          ['Validation gate', 'Required before freeze'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white px-5 py-4">
            <div className="font-display text-[28px] font-semibold text-ink">{v}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">{k}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
          Generated identities preview
        </div>
        <div className="divide-y divide-line">
          {buildings.slice(0, 8).map((b) => (
            <div key={b.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-ink">{b.name}</div>
                  <div className="font-mono mt-1 text-[11px] text-signal">{b.ulpin}</div>
                </div>
                <div className="text-[12px] text-mute">{b.floors?.length || 0} floor PINs</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link to="/app/registry" className="text-[13px] font-semibold text-signal">
        Open registry →
      </Link>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/registry"
          className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          Register final records
        </Link>
        <Link
          to="/app/twin"
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
        >
          Open 3D Atlas
        </Link>
      </div>
    </div>
  )
}
