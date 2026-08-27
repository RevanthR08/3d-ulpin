import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ownedProperties } from '../lib/demoAccounts'
import { adminTwinHref, citizenTwinHref, VIEWERS } from '../lib/viewers'

/** Full-bleed Intel City 3D twin — admin: full city; citizen: locked house. */
export function TwinViewerPage() {
  const { auth, selectedUlpin } = useAuth()
  const isAdmin = auth?.role === 'admin'
  const holdings = !isAdmin && selectedUlpin ? ownedProperties(selectedUlpin) : []
  const [viewUlpin, setViewUlpin] = useState(selectedUlpin)

  const twinHref = isAdmin
    ? adminTwinHref()
    : viewUlpin
      ? citizenTwinHref(viewUlpin, { interior: true })
      : null

  return (
    <div className="page-enter flex h-full min-h-[calc(100vh-3.5rem)] flex-col bg-paper-dim">
      <div className="flex flex-none flex-col gap-3 border-b border-line bg-paper px-7 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-semibold text-ink">
            {isAdmin ? '3D Atlas' : 'Your 3D properties'}
          </h1>
          <p className="mt-0.5 text-[12px] text-mute">
            {isAdmin
              ? 'Intel City twin — full roam, floors, interiors, underground'
              : holdings.length > 0
                ? `${holdings.length} ${holdings.length === 1 ? 'house' : 'houses'} on this account — pick one to inspect`
                : 'Set your ULPIN on My Property first'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {twinHref ? (
            <a
              href={twinHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-white"
            >
              Full screen
            </a>
          ) : (
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
        {!isAdmin && holdings.length > 0 && (
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
                    <div className="font-mono text-[10px] text-mute">F{h.floor}-{h.unit}</div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {twinHref ? (
          <iframe
            key={twinHref}
            title={isAdmin ? '3D Atlas' : 'My 3D House'}
            src={twinHref}
            className="h-full min-h-[560px] w-full border-0 bg-ink"
            allow="fullscreen"
          />
        ) : (
          <div className="flex min-h-[560px] flex-col items-center justify-center gap-4 bg-[#0B1210] px-8 text-center">
            <div className="font-display text-[22px] font-semibold text-white">No property selected</div>
            <p className="max-w-md text-[13px] leading-relaxed text-white/55">
              Resolve a parcel on My Property, then return here for your locked 3D house.
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
