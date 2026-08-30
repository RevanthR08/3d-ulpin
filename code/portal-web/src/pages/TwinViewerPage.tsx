import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isCitizenDemoUlpin, ownedProperties, resolveCitizenUlpin } from '../lib/demoAccounts'
import { adminTwinHref, citizenTwinHref, VIEWERS } from '../lib/viewers'

/** Full-bleed Intel City 3D twin — admin: full city; citizen: locked house. */
export function TwinViewerPage() {
  const { auth, selectedUlpin, selectUlpin } = useAuth()
  const [params] = useSearchParams()
  const isAdmin = auth?.role === 'admin'
  const holdings = !isAdmin && selectedUlpin ? ownedProperties(selectedUlpin) : []
  const qUlpin = params.get('ulpin')
  const [viewUlpin, setViewUlpin] = useState(
    qUlpin && isCitizenDemoUlpin(qUlpin) ? qUlpin : selectedUlpin,
  )

  useEffect(() => {
    if (isAdmin) return
    const next = qUlpin && isCitizenDemoUlpin(qUlpin) ? qUlpin : selectedUlpin
    if (!next) return
    const locked = resolveCitizenUlpin(next)
    setViewUlpin(locked)
    if (locked !== selectedUlpin) selectUlpin(locked)
  }, [isAdmin, qUlpin, selectedUlpin, selectUlpin])

  const qAir = params.get('air') === '1'
  const qUg = params.get('ug') === '1'
  const twinHref = isAdmin
    ? adminTwinHref({ air: qAir, ug: qUg })
    : viewUlpin
      ? citizenTwinHref(viewUlpin)
      : null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-paper-dim">
      <div className="flex flex-none flex-col gap-2 border-b border-line bg-paper px-7 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[22px] font-semibold text-ink">
              {isAdmin ? '3D Atlas' : 'Your 3D house'}
            </h1>
            <p className="mt-0.5 text-[12px] text-mute">
              {isAdmin
                ? 'Intel City twin — floors, interiors, underground, air rights'
                : holdings.length > 0
                  ? 'Close view of your house — ownership and rooms in the right panel'
                  : 'Set your ULPIN on My Property first'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Link
                to={qAir ? '/app/twin' : '/app/twin?air=1'}
                className={`rounded-lg px-3.5 py-2 text-[12px] font-semibold ${
                  qAir
                    ? 'border border-signal bg-signal-soft text-signal-deep'
                    : 'border border-line bg-white text-ink hover:border-signal'
                }`}
              >
                Air rights
              </Link>
            )}
            {isAdmin && twinHref && (
              <a
                href={twinHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-white"
              >
                Full screen
              </a>
            )}
            {!twinHref && (
              <Link
                to="/citizen/property"
                className="rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-white"
              >
                Set my ULPIN
              </Link>
            )}
            {isAdmin && (
              <a
                href={VIEWERS.societyBlock}
                target="_blank"
                rel="noreferrer"
                className="px-1 text-[11px] text-mute hover:text-signal"
              >
                Society QA
              </a>
            )}
          </div>
        </div>
        {!isAdmin && holdings.length > 1 && (
          <ul className="flex flex-wrap gap-2">
            {holdings.map((h) => {
              const active = h.ulpin === viewUlpin
              return (
                <li key={h.ulpin}>
                  <button
                    type="button"
                    onClick={() => setViewUlpin(h.ulpin)}
                    className={`rounded-xl border px-3 py-2 text-left ${
                      active
                        ? 'border-signal bg-signal-soft text-signal-deep'
                        : 'border-line bg-white text-ink hover:border-signal'
                    }`}
                  >
                    <div className="text-[12px] font-semibold">{h.building}</div>
                    <div className="font-mono text-[10px] text-mute">
                      F{h.floor}-{h.unit}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {twinHref ? (
          <iframe
            key={twinHref}
            title={isAdmin ? '3D Atlas' : 'My 3D House'}
            src={twinHref}
            className="h-full w-full border-0 bg-ink"
            allow="fullscreen"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0B1210] px-8 text-center">
            <div className="font-display text-[22px] font-semibold text-white">No property selected</div>
            <p className="max-w-md text-[13px] leading-relaxed text-white/55">
              Open My Property, then return here for your locked 3D house.
            </p>
            <Link
              to="/citizen/property"
              className="rounded-xl bg-signal px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              Go to My Property
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
