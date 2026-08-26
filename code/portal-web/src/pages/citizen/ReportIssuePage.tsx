import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { addIssueReport } from '../../lib/storage'

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
  const [ulpin, setUlpin] = useState(selectedUlpin || '')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const report = addIssueReport({
      ulpin: ulpin.trim() || 'Not specified',
      category,
      description: description.trim(),
      contact: contact.trim() || undefined,
    })
    setSubmittedId(report.id)
    setDescription('')
  }

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Report an Issue</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Flag an incorrect digital property record for admin review. This is report collection,
          not a formal dispute-resolution workflow.
        </p>
      </div>

      {submittedId && (
        <div className="rounded-xl border border-ok/25 bg-ok/5 px-4 py-3 text-[13px] text-ok">
          Report submitted. Reference: <span className="font-mono">{submittedId}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-6">
        <label className="block">
          <span className="text-[12px] font-semibold text-ink">Related PIN / ULPIN</span>
          <input
            value={ulpin}
            onChange={(e) => setUlpin(e.target.value)}
            placeholder="3D-IND-600001-I1-L5"
            className="font-mono mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-[13px] outline-none focus:border-signal"
          />
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
            placeholder="Describe the wrong boundary, owner, missing floor/unit, incorrect ULPIN, or affected underground asset."
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
          Submit report
        </button>
      </form>

      <Link to="/citizen/record" className="text-[13px] font-semibold text-signal">
        Back to property record →
      </Link>
    </div>
  )
}
