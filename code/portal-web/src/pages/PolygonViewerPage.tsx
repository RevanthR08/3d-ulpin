import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { adminTwinHref, citizenTwinHref, VIEWERS } from '../lib/viewers'

export function PolygonViewerPage() {
  const { auth, selectedUlpin } = useAuth()
  const isAdmin = auth?.role === 'admin'
  const title = isAdmin ? '3D Parcel Viewer' : '3D Property Viewer'
  const twinHref = isAdmin ? adminTwinHref({ ulpin: selectedUlpin }) : citizenTwinHref(selectedUlpin)

  return (
    <div className="page-enter flex h-full min-h-[calc(100vh-3.5rem)] flex-col bg-paper-dim">
      <div className="flex flex-none flex-wrap items-center justify-between gap-4 border-b border-line bg-paper px-7 py-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-[13px] text-mute">
            Interactive 3D cadastral twin showing buildings, floors, units, underground assets,
            and vertical rights relationships.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={twinHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            Open full screen
          </a>
          <Link
            to="/app/map"
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
          >
            Parcel map
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_320px]">
        <iframe
          title={title}
          src={twinHref}
          className="h-full min-h-[560px] w-full border-0 bg-ink"
          allow="fullscreen"
        />

        <aside className="overflow-y-auto border-l border-line bg-white p-5">
          <div className="rounded-2xl border border-line bg-paper p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Selected identity</div>
            <div className="font-mono mt-2 break-all text-[12px] text-signal">
              {selectedUlpin || 'Select a ULPIN from Registry / Parcel Map'}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {[
              ['Vertical extent', 'Floor-level volumes are visible as selectable 3D objects.'],
              ['Underground layer', 'Subsurface assets remain part of the 3D property context.'],
              ['Air rights', 'Overhead usage constraints are represented as vertical rights, not flat parcel lines.'],
              ['Registry binding', 'Each parcel/body/floor can be traced back to a PIN/ULPIN record.'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-white px-4 py-3">
                <div className="text-[13px] font-semibold text-ink">{k}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-mute">{v}</div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
              <div className="text-[13px] font-semibold text-ink">QA viewers</div>
              <div className="mt-3 flex flex-col gap-2">
                <a href={VIEWERS.chennai} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-signal">
                  Chennai GLB QA →
                </a>
                <a href={VIEWERS.societyBlock} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-signal">
                  Society block QA →
                </a>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
