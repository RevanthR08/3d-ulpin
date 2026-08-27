import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { VIEWERS } from '../lib/viewers'

/** TUM GlobalBuildingAtlas LoD1 — https://tubvsig-so2sat-vm1.srv.mwn.de/ */
const GBA_URL = 'https://tubvsig-so2sat-vm1.srv.mwn.de/#15/13.0827/80.2707'
const TERMS_KEY = 'vertica_gba_terms_ack'
/** Approx height of GBA’s own top bar — pull iframe up so it sits under our chrome. */
const GBA_CHROME_PX = 52

function readTermsAck() {
  try {
    return localStorage.getItem(TERMS_KEY) === '1'
  } catch {
    return false
  }
}

function GbaPanel() {
  const [termsAck, setTermsAck] = useState(readTermsAck)

  function ackTerms() {
    localStorage.setItem(TERMS_KEY, '1')
    setTermsAck(true)
  }

  if (!termsAck) {
    return (
      <div className="flex h-full min-h-[560px] flex-col items-center justify-center gap-5 bg-ink px-8 text-center">
        <div className="font-display text-[28px] font-semibold text-white">GlobalBuildingAtlas</div>
        <p className="max-w-md text-[14px] leading-relaxed text-white/55">
          External TUM LoD1 building atlas. Agree once, then the 2D iframe loads (Chennai).
        </p>
        <button
          type="button"
          onClick={ackTerms}
          className="rounded-xl bg-signal px-6 py-3 text-[13px] font-semibold text-white hover:bg-signal-deep"
        >
          Continue to atlas
        </button>
        <a href={GBA_URL} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-signal">
          Open in new tab →
        </a>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <iframe
        title="GlobalBuildingAtlas 2D"
        src={GBA_URL}
        className="absolute left-0 w-full border-0 bg-white"
        style={{
          top: -GBA_CHROME_PX,
          height: `calc(100% + ${GBA_CHROME_PX}px)`,
        }}
        referrerPolicy="no-referrer-when-downgrade"
        allow="fullscreen"
      />
    </div>
  )
}

/** Operator 2D City Atlas — our chrome overlaps / hides GBA’s header. */
export function PolygonViewerPage() {
  const { auth } = useAuth()
  const isAdmin = auth?.role === 'admin'

  if (!isAdmin) {
    return (
      <div className="page-enter flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 bg-paper-dim px-8 text-center">
        <div className="font-display text-[22px] font-semibold text-ink">Operator atlas</div>
        <p className="max-w-md text-[13px] text-mute">
          GlobalBuildingAtlas is for operators. Open your locked house in 3D Atlas.
        </p>
        <Link
          to="/app/twin"
          className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          Open 3D Atlas
        </Link>
      </div>
    )
  }

  return (
    <div className="page-enter relative h-full min-h-[calc(100vh-3.5rem)] overflow-hidden bg-paper-dim">
      <GbaPanel />

      {/* VERTICA chrome sits on top of GBA’s GlobalBuildingAtlas / TUM bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/95 px-7 py-3 shadow-sm backdrop-blur-sm">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-semibold text-ink">City Atlas</h1>
          <p className="mt-0.5 text-[12px] text-mute">2D · GlobalBuildingAtlas (TUM)</p>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <a
            href={GBA_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-white"
          >
            Full screen
          </a>
          <Link
            to="/app/twin"
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12px] font-semibold text-ink"
          >
            3D Atlas
          </Link>
          <a
            href={VIEWERS.societyBlock}
            target="_blank"
            rel="noreferrer"
            className="px-1 text-[11px] text-mute hover:text-signal"
          >
            Society QA
          </a>
        </div>
      </div>
    </div>
  )
}
