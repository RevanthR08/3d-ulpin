import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type UnitDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export function OwnershipPage() {
  const { selectedUlpin } = useAuth()
  const [unit, setUnit] = useState<UnitDetail | null>(null)

  useEffect(() => {
    if (!selectedUlpin) return
    api.unit(selectedUlpin).then(setUnit).catch(() => setUnit(null))
  }, [selectedUlpin])

  const ulpin = selectedUlpin || unit?.ulpin || 'Select a ULPIN from Map or Property'

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Ownership</h1>
        <p className="mt-2 text-[14px] text-mute">
          Ownership, rights, and vertical-space relationships bound to the selected volumetric parcel.
        </p>
      </div>

      <div className="panel-slide relative overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
        <div className="absolute right-6 top-6 rotate-[-8deg] rounded-lg border-2 border-ok px-3 py-1.5 text-[13px] font-bold tracking-[0.2em] text-ok">
          APPROVED
        </div>
        <div className="border-b border-line bg-paper px-8 py-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-mute">
            Department of Land Resources
          </div>
          <div className="font-display mt-2 text-[24px] font-semibold">
            Vertical property certificate
          </div>
        </div>
        <div className="space-y-5 px-8 py-7">
          <div>
            <div className="text-[11px] text-mute">3D ULPIN</div>
            <div className="font-mono mt-1 text-[14px] text-signal break-all">{ulpin}</div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="text-[11px] text-mute">Registered owner</div>
              <div className="mt-1 text-[16px] font-semibold">{unit?.owner || 'Demo Holder'}</div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Unit / floor</div>
              <div className="mt-1 text-[16px] font-semibold">
                {unit?.unit ?? '—'} · F{unit?.floor_label ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Building</div>
              <div className="mt-1 text-[16px] font-semibold">
                {unit?.building_name || unit?.building_id || '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Status</div>
              <div className="mt-1 text-[16px] font-semibold text-ok">
                {unit?.legal_status || 'Registered'}
              </div>
            </div>
          </div>
          <p className="border-t border-line pt-4 text-[12px] leading-relaxed text-mute">
            This demonstration record maps cadastral identity to a vertical parcel. It is not a
            substitute for statutory title documents.
          </p>
          <div className="rounded-xl border border-signal/20 bg-signal-soft/50 px-4 py-3">
            <div className="text-[13px] font-semibold text-ink">Air-rights context</div>
            <div className="mt-1 text-[12px] leading-relaxed text-mute">
              If an elevated road, metro, or utility crosses above this property, that overhead
              usage is represented as a vertical rights relationship, not as a normal 2D boundary.
            </div>
          </div>
        </div>
      </div>

      {!selectedUlpin && (
        <Link to="/app/twin" className="text-[13px] font-semibold text-signal">
          Open 3D Atlas →
        </Link>
      )}
    </div>
  )
}
