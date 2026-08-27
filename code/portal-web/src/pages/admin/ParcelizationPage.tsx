import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type IntelCityRegistry, type SocietySummary } from '../../lib/api'

export function ParcelizationPage() {
  const [society, setSociety] = useState<SocietySummary | null>(null)
  const [city, setCity] = useState<IntelCityRegistry | null>(null)

  useEffect(() => {
    api.society().then(setSociety).catch(() => setSociety(null))
    api.intelCity().then(setCity).catch(() => setCity(null))
  }, [])

  const buildings = society?.computed_totals?.total_buildings ?? city?.meta?.building_count ?? '—'
  const floors = society?.computed_totals?.total_floors ?? city?.meta?.floor_count ?? '—'

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">3D Parcelization</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Converts extracted footprints and height/elevation data into cadastral volumes:
          one main parcel containing multiple physical bodies, floors, units, rights, and
          restricted spaces.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Main parcel', 'Site boundary and cadastral envelope'],
          ['Bodies', `${buildings} mapped building/property objects`],
          ['Vertical slices', `${floors} floor-level ownership spaces`],
          ['Rights layer', 'Air, access, and underground relationships'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-line bg-white p-5">
            <div className="text-[13px] font-semibold text-ink">{title}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-mute">{body}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Parcel model</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ['1. Boundary creation', '2D footprints become horizontal limits for each physical body.'],
            ['2. Height binding', 'Floor elevations define base and top surfaces for each volume.'],
            ['3. Rights mapping', 'Air-rights and access constraints are linked to the affected volume, not treated as flat parcels.'],
            ['4. Validation handoff', 'Only clean geometry moves to ULPIN generation and registry freeze.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl bg-paper px-4 py-3">
              <div className="text-[13px] font-semibold text-ink">{title}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-mute">{body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/app/registry?tab=floors" className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white">
          Open floors & units
        </Link>
        <Link to="/app/twin" className="rounded-xl border border-signal/30 bg-signal-soft px-4 py-2.5 text-[13px] font-semibold text-signal-deep">
          Inspect in 3D Atlas
        </Link>
        <Link to="/app/validation" className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold">
          Validate geometry
        </Link>
      </div>
    </div>
  )
}
