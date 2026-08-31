import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, findIntelCityHouse, type IntelCityHouse } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ownedProperties, type DemoCitizenAccount } from '../../lib/demoAccounts'
import { toPublicUlpin } from '../../lib/ulpin'

function statusClass(status?: string) {
  const s = (status || '').toLowerCase()
  if (s.includes('dispute')) return 'bg-amber/15 text-amber'
  if (s.includes('mortgage')) return 'bg-signal-soft text-signal-deep'
  if (s.includes('lease')) return 'bg-paper text-mute'
  return 'bg-ok/10 text-ok'
}

function TitlePopup({
  pick,
  holding,
  onClose,
}: {
  pick: IntelCityHouse
  holding: DemoCitizenAccount
  onClose: () => void
}) {
  const { building, floor, unit } = pick
  const prev = floor.previous_owners || []
  const utils = floor.utilities || []

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel-slide max-h-[min(90vh,760px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="title-popup"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Full title dossier</div>
            <h2 id="title-popup" className="font-display mt-1 text-[22px] font-semibold text-ink">
              {building.name} · F{holding.floor}-{holding.unit}
            </h2>
            <div className="mt-1 text-[12px] text-mute">
              {building.name} → Floor {floor.floor_label} → House {unit.unit_label || holding.unit}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[12px] font-semibold text-mute hover:bg-paper hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-mute">ULPIN</div>
            <div className="font-mono mt-1 break-all text-[13px] text-signal">{toPublicUlpin(unit.ulpin)}</div>
          </div>

          <div>
            <div className="text-[20px] font-semibold text-ink">{unit.owner || holding.owner}</div>
            <div className="font-mono mt-0.5 text-[11px] text-mute">
              {unit.owner_id || floor.owner_id || 'Aadhaar on file'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Area', unit.area_sq_m != null ? `${unit.area_sq_m} m²` : '—'],
              ['Use', unit.use || floor.use || '—'],
              ['Floor parcel', floor.area_sq_m != null ? `${floor.area_sq_m} m²` : '—'],
              ['Carpet', floor.carpet_sq_m != null ? `${floor.carpet_sq_m} m²` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-paper px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-mute">{k}</div>
                <div className="mt-0.5 text-[13px] font-semibold text-ink">{v}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Registration</h3>
            <div className="mt-2 space-y-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-mute">Status</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                    unit.legal_status || floor.legal_status,
                  )}`}
                >
                  {unit.legal_status || floor.legal_status || 'registered'}
                </span>
              </div>
              <div>
                <span className="text-mute">Bought / registered on </span>
                <span className="font-semibold text-ink">
                  {unit.registered_on || floor.registered_on || '—'}
                </span>
              </div>
              <div>
                <span className="text-mute">Office </span>
                <span className="text-ink">{floor.registration_office || '—'}</span>
              </div>
              <div>
                <span className="text-mute">Deed </span>
                <code className="rounded bg-paper px-1.5 py-0.5 text-[12px] text-ink">
                  {unit.deed_no || floor.deed_no || '—'}
                </code>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Previous owners</h3>
            <ul className="mt-2 space-y-2">
              {prev.length ? (
                prev.map((row) => (
                  <li key={`${row.name}-${row.from}`} className="rounded-xl border border-line bg-paper px-3 py-2">
                    <div className="text-[13px] font-semibold text-ink">{row.name}</div>
                    <div className="text-[11px] text-mute">
                      {row.from} → {row.to}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-mute">No prior chain on file</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Use & assessment</h3>
            <div className="mt-2 space-y-1.5 text-[13px]">
              <div>
                <span className="text-mute">Tax </span>
                <span className="text-ink">{floor.tax_assessment || '—'}</span>
              </div>
              <div>
                <span className="text-mute">Encumbrance </span>
                <span className="text-ink">{floor.encumbrance || '—'}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Utilities</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {utils.length ? (
                utils.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink"
                  >
                    {name}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-mute">—</span>
              )}
            </div>
          </div>

          {floor.notes && (
            <p className="text-[12px] leading-relaxed text-mute">{floor.notes}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Link
              to={`/app/twin?ulpin=${encodeURIComponent(unit.ulpin)}`}
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Open in 3D
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OwnershipPage() {
  const { selectedUlpin } = useAuth()
  const holdings = selectedUlpin ? ownedProperties(selectedUlpin) : []
  const [houses, setHouses] = useState<Record<string, IntelCityHouse | null>>({})
  const [openUlpin, setOpenUlpin] = useState<string | null>(null)

  useEffect(() => {
    if (holdings.length === 0) return
    let cancelled = false
    api
      .intelCity()
      .then((reg) => {
        if (cancelled) return
        const next: Record<string, IntelCityHouse | null> = {}
        for (const h of holdings) next[h.ulpin] = findIntelCityHouse(reg, h.ulpin)
        setHouses(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUlpin])

  const openHolding = holdings.find((h) => h.ulpin === openUlpin)
  const openPick = openUlpin ? houses[openUlpin] : null

  return (
    <div className="page-enter relative mx-auto max-w-3xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Ownership</h1>
        <p className="mt-2 text-[14px] text-mute">
          Title certificates for every parcel. Open a card for the full dossier — status, deed, bought
          date, prior owners, tax, and encumbrance.
        </p>
      </div>

      {holdings.map((p) => {
        const pick = houses[p.ulpin]
        const unit = pick?.unit
        const floor = pick?.floor
        return (
          <button
            key={p.ulpin}
            type="button"
            onClick={() => setOpenUlpin(p.ulpin)}
            className="panel-slide relative w-full overflow-hidden rounded-2xl border border-line bg-white text-left shadow-lg transition hover:border-signal"
          >
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
              <div className="mt-1 text-[13px] text-mute">
                {p.building} · Floor {p.floor} · House {p.unit}
              </div>
            </div>
            <div className="space-y-4 px-8 py-6">
              <div>
                <div className="text-[11px] text-mute">Registered owner</div>
                <div className="mt-1 text-[18px] font-semibold">{unit?.owner || p.owner}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                    unit?.legal_status || floor?.legal_status,
                  )}`}
                >
                  {unit?.legal_status || floor?.legal_status || 'registered'}
                </span>
                <span className="text-[13px] text-mute">
                  Bought {unit?.registered_on || floor?.registered_on || '—'}
                </span>
              </div>
              <div className="text-[13px] font-semibold text-signal">Open full title →</div>
            </div>
          </button>
        )
      })}

      {openHolding && openPick && (
        <TitlePopup pick={openPick} holding={openHolding} onClose={() => setOpenUlpin(null)} />
      )}
    </div>
  )
}
