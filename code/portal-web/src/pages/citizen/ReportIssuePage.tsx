import { useState, type FormEvent } from 'react'
import { useAuth } from '../../lib/auth'
import { lookupCitizenAccount, ownedProperties } from '../../lib/demoAccounts'
import { addIssueReport } from '../../lib/storage'
import { useCitizenTickets } from '../../lib/tickets'

const CATEGORIES = [
  'Incorrect boundary',
  'Incorrect ownership',
  'Missing floor / unit',
  'Incorrect property information',
  'Incorrect PIN / ULPIN',
  'Underground asset concern',
  'Other spatial/property issue',
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

  function submit(e: FormEvent) {
    e.preventDefault()
    const chosen = holdings.find((h) => h.ulpin === ulpin) || holdings[0]
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
    <div className="page-enter mx-auto max-w-3xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Report an Issue</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Raise a ticket on a wrong digital record. After you submit, it opens in your tickets panel
          with status (Raised → In review → Closed).
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-6">
        <label className="block">
          <span className="text-[12px] font-semibold text-ink">Related property</span>
          <select
            value={ulpin}
            onChange={(e) => setUlpin(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13px] outline-none focus:border-signal"
          >
            {holdings.map((h) => (
              <option key={h.ulpin} value={h.ulpin}>
                {h.building} · F{h.floor}-{h.unit} · {h.ulpin}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-ink">Issue category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13px] outline-none focus:border-signal"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-ink">What should be reviewed?</span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Describe the wrong boundary, owner, missing floor/unit, incorrect ULPIN, or affected connection."
            className="mt-2 w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-[13px] outline-none focus:border-signal"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-ink">Contact / note optional</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone, email, or local reference"
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13px] outline-none focus:border-signal"
          />
        </label>

        <button
          type="submit"
          className="rounded-xl bg-ink px-5 py-3 text-[13px] font-semibold text-white disabled:opacity-50"
          disabled={!description.trim()}
        >
          Raise ticket
        </button>
      </form>
    </div>
  )
}
