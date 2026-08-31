import { useState, type FormEvent } from 'react'
import { HiOutlineArrowRight, HiOutlineFlag, HiOutlineMapPin } from 'react-icons/hi2'
import { useAuth } from '../../lib/auth'
import { lookupCitizenAccount, ownedProperties } from '../../lib/demoAccounts'
import { addIssueReport } from '../../lib/storage'
import { useCitizenTickets } from '../../lib/tickets'
import { toPublicUlpin } from '../../lib/ulpin'

const CATEGORIES = [
  'Incorrect boundary',
  'Incorrect ownership',
  'Missing floor / unit',
  'Incorrect property information',
  'Incorrect PIN / ULPIN',
  'Underground asset concern',
  'Other spatial / property issue',
]

export function ReportIssuePage() {
  const { selectedUlpin } = useAuth()
  const { openPanel } = useCitizenTickets()
  const holdings = selectedUlpin ? ownedProperties(selectedUlpin) : []
  const account = selectedUlpin ? lookupCitizenAccount(selectedUlpin) : undefined
  const [ulpin, setUlpin] = useState(holdings[0]?.ulpin || selectedUlpin || '')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [location, setLocation] = useState('')
  const [locating, setLocating] = useState(false)

  const chosen = holdings.find((h) => h.ulpin === ulpin) || holdings[0]

  function findCurrentLocation() {
    setLocating(true)
    window.setTimeout(() => {
      setLocation('Chennai Institute of Technology')
      setLocating(false)
    }, 1000)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const report = addIssueReport({
      ulpin: ulpin.trim() || 'Not specified',
      category,
      description: description.trim(),
      contact: contact.trim() || undefined,
      citizenName: account?.owner,
      building: chosen?.building,
      ward: 'T. Nagar · Ward 116',
      priority: 'medium',
      assignedTo: 'Unassigned',
    })
    setDescription('')
    openPanel(report.id)
  }

  return (
    <div className="page-enter mx-auto max-w-2xl space-y-7 px-7 py-8">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-signal-deep">
          <HiOutlineFlag className="h-4 w-4" />
          Record issue
        </div>
        <h1 className="mt-2 font-display text-[32px] font-semibold text-ink">Report an Issue</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] leading-relaxed text-mute">
          Flag a wrong digital record. It opens in your tickets panel and moves through
          <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">Raised</span>
          <span className="text-mute/50">→</span>
          <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[11px] font-semibold text-signal-deep">In review</span>
          <span className="text-mute/50">→</span>
          <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok">Closed</span>
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-line bg-white p-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Location</div>
          <div className="relative mt-2">
            <HiOutlineMapPin className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-mute" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location or find current location"
              className="w-full rounded-xl border border-line bg-paper py-3 pl-10 pr-[7.5rem] text-[13.5px] outline-none focus:border-signal focus:bg-white"
            />
            <button
              type="button"
              onClick={findCurrentLocation}
              disabled={locating}
              className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-signal-soft px-2.5 py-1.5 text-[11px] font-semibold text-signal-deep transition hover:bg-signal-soft/70 disabled:opacity-60"
            >
              <HiOutlineMapPin className="h-3.5 w-3.5" />
              {locating ? 'Locating…' : 'Current'}
            </button>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Related property</div>
          {chosen ? (
            <div className="mt-2 rounded-xl border border-line bg-paper px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[14px] font-semibold text-ink">
                  {chosen.building} · Floor {chosen.floor} · House {chosen.unit}
                </div>
                {holdings.length > 1 && (
                  <select
                    value={ulpin}
                    onChange={(e) => setUlpin(e.target.value)}
                    className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-signal"
                  >
                    {holdings.map((h) => (
                      <option key={h.ulpin} value={h.ulpin}>
                        {h.building} · F{h.floor}-{h.unit}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mt-1 font-mono text-[11px] text-signal-deep">{toPublicUlpin(chosen.ulpin)}</div>
            </div>
          ) : (
            <input
              value={ulpin}
              onChange={(e) => setUlpin(e.target.value)}
              placeholder="Property ULPIN"
              className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 font-mono text-[13px] outline-none focus:border-signal focus:bg-white"
            />
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">What kind of issue?</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = category === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={on}
                  className={`rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition ${
                    on
                      ? 'border-signal bg-signal-soft text-signal-deep'
                      : 'border-line bg-paper text-ink hover:border-signal/40'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
            What&rsquo;s wrong with the record?
          </span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Describe the wrong boundary, owner, missing floor/unit, incorrect ULPIN, or affected service connection — with any reference numbers or dates you have."
            className="mt-2 w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-[13.5px] leading-relaxed outline-none focus:border-signal focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
            Contact for follow-up{' '}
            <span className="font-normal normal-case tracking-normal text-mute/70">— optional</span>
          </span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone, email, or local reference"
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13.5px] outline-none focus:border-signal focus:bg-white"
          />
        </label>

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] leading-relaxed text-mute">
            Logged for the land office{account?.owner ? ` · ${account.owner}` : ''} · T. Nagar Ward 116
          </p>
          <button
            type="submit"
            disabled={!description.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-signal-deep disabled:opacity-50"
          >
            Raise ticket
            <HiOutlineArrowRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </form>
    </div>
  )
}
