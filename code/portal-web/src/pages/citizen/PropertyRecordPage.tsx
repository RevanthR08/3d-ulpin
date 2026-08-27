import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, resolveIntelCityUnit, type UnitDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export function PropertyRecordPage() {
  const { selectedUlpin } = useAuth()
  const [record, setRecord] = useState<UnitDetail | null>(null)

  useEffect(() => {
    if (!selectedUlpin) return
    api
      .intelCity()
      .then((reg) => setRecord(resolveIntelCityUnit(reg, selectedUlpin)))
      .catch(() => setRecord(null))
  }, [selectedUlpin])

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Property Record</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Official cadastral record view for the selected parcel/body/floor identity.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        {selectedUlpin ? (
          <div className="space-y-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-mute">PIN / ULPIN</div>
              <div className="font-mono mt-2 break-all text-[16px] text-signal">{selectedUlpin}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['Property body', record?.building_name || record?.building_id || 'Mapped body'],
                ['Floor / vertical level', record?.floor_label != null ? `Floor ${record.floor_label}` : 'Building parcel'],
                ['Owner / right holder', record?.owner || 'Demo holder'],
                ['Legal status', record?.legal_status || 'registered'],
                ['Measured area', record?.area_sq_m != null ? `${record.area_sq_m} m²` : 'Available in registry'],
                ['Record type', '3D cadastral identity'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-paper px-4 py-3">
                  <div className="text-[11px] text-mute">{k}</div>
                  <div className="mt-1 text-[14px] font-semibold text-ink">{v}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-signal/20 bg-signal-soft/50 px-4 py-3">
              <div className="text-[13px] font-semibold text-ink">Rights relationship</div>
              <div className="mt-1 text-[12px] leading-relaxed text-mute">
                Surface ownership, floor ownership, underground influence, and air-rights constraints
                are treated as linked 3D rights, not separate flat parcel boundaries.
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-[13px] text-mute">
            Select a ULPIN from the registry or 3D Atlas to load a record.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/app/registry" className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold">
          Open registry
        </Link>
        <Link to="/app/twin" className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white">
          Open 3D Atlas
        </Link>
      </div>
    </div>
  )
}
