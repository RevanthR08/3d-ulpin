import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  getIssueReports,
  sendClarificationMail,
  updateIssueReportStatus,
  type CitizenIssue,
  type DisputeMessage,
  type IssueStatus,
} from '../../lib/storage'
import { BackendDisputes } from './BackendDisputes'

const STATUS_LABEL: Record<IssueStatus, string> = {
  new: 'New',
  in_review: 'In review',
  closed: 'Closed',
}

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-danger/10 text-danger',
  medium: 'bg-amber/15 text-amber',
  low: 'bg-mute/15 text-mute',
}

type FilterKey = 'all' | IssueStatus

export function ReportsIssuesPage() {
  const [reports, setReports] = useState<CitizenIssue[]>(() => getIssueReports())
  const [filter, setFilter] = useState<FilterKey>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return reports
    return reports.filter((r) => r.status === filter)
  }, [reports, filter])

  const openReport = useMemo(
    () => (openId ? reports.find((r) => r.id === openId) || null : null),
    [reports, openId],
  )

  useEffect(() => {
    if (!openId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null)
    }
    window.addEventListener('keydown', onKey)

    const main = document.getElementById('vertica-main')
    const prevBody = document.body.style.overflow
    const prevMain = main?.style.overflow ?? ''
    document.body.style.overflow = 'hidden'
    if (main) main.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevBody
      if (main) main.style.overflow = prevMain
    }
  }, [openId])

  function toast(msg: string) {
    setNote(msg)
    window.setTimeout(() => setNote(null), 3200)
  }

  function setStatus(id: string, status: IssueStatus, msg?: string) {
    setReports(updateIssueReportStatus(id, status))
    if (msg) toast(msg)
  }

  function onMailSent(next: CitizenIssue[], disputeId: string) {
    setReports(next)
    setOpenId(disputeId)
    toast(`Mail sent to citizen · ${disputeId}`)
  }

  function copyUlpin(ulpin: string) {
    void navigator.clipboard.writeText(ulpin)
    toast(`Copied ULPIN ${ulpin}`)
  }

  const counts = useMemo(
    () => ({
      all: reports.length,
      new: reports.filter((r) => r.status === 'new').length,
      in_review: reports.filter((r) => r.status === 'in_review').length,
      closed: reports.filter((r) => r.status === 'closed').length,
    }),
    [reports],
  )

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-6 px-7 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-ink">Reports / Issues</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
            Open a dispute for dossier, mail thread, and operator actions. Clarification mails are
            mocked as sent to the citizen inbox.
          </p>
        </div>
        {note && (
          <div className="rounded-xl border border-ok/25 bg-ok/5 px-3 py-2 text-[12px] font-semibold text-ok">
            {note}
          </div>
        )}
      </div>

      <BackendDisputes />

      <div className="border-t border-line pt-6">
        <h2 className="font-display text-[20px] font-semibold text-ink">Citizen record issues</h2>
        <p className="mt-1 text-[13px] text-mute">
          Legacy citizen-submitted issues with dossier, mail thread, and operator actions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {(
          [
            ['all', 'All disputes'],
            ['new', 'New'],
            ['in_review', 'In review'],
            ['closed', 'Closed'],
          ] as Array<[FilterKey, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-2xl border px-5 py-4 text-left transition ${
              filter === key ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-signal'
            }`}
          >
            <div className="font-display text-[28px] font-semibold">{counts[key]}</div>
            <div
              className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${
                filter === key ? 'text-white/70' : 'text-mute'
              }`}
            >
              {label}
            </div>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
          Dispute queue · {filtered.length} · click to open modal
        </div>
        <div className="divide-y divide-line">
          {filtered.map((report) => (
            <DisputeRow
              key={report.id}
              report={report}
              onOpen={() => setOpenId(report.id)}
            />
          ))}
          {!filtered.length && (
            <div className="px-5 py-12 text-center text-[13px] text-mute">
              No disputes in this filter.
            </div>
          )}
        </div>
      </div>

      {openReport &&
        createPortal(
          <DisputeModal
            report={openReport}
            onClose={() => setOpenId(null)}
            onStatus={setStatus}
            onCopyUlpin={copyUlpin}
            onMailSent={onMailSent}
          />,
          document.body,
        )}
    </div>
  )
}

function statusTone(status: IssueStatus) {
  if (status === 'new') return 'bg-signal/10 text-signal'
  if (status === 'in_review') return 'bg-amber/15 text-amber'
  return 'bg-ok/10 text-ok'
}

function DisputeRow({ report, onOpen }: { report: CitizenIssue; onOpen: () => void }) {
  const priority = report.priority || 'medium'
  const msgCount = report.messages?.length || 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-start justify-between gap-3 px-5 py-4 text-left hover:bg-paper/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-mute">{report.id}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(report.status)}`}
          >
            {STATUS_LABEL[report.status]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[priority]}`}
          >
            {priority}
          </span>
          {msgCount > 0 && (
            <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-semibold text-mute">
              {msgCount} messages
            </span>
          )}
        </div>
        <div className="mt-1.5 text-[15px] font-semibold text-ink">{report.category}</div>
        <div className="mt-1 text-[12px] text-mute">
          Filed by <span className="font-semibold text-ink">{report.citizenName || 'Citizen'}</span>
          {report.building ? ` · ${report.building}` : ''}
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-mute">{report.description}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="text-[11px] text-mute">{new Date(report.createdAt).toLocaleString()}</div>
        <span className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink">
          Open case
        </span>
      </div>
    </button>
  )
}

function DisputeModal({
  report,
  onClose,
  onStatus,
  onCopyUlpin,
  onMailSent,
}: {
  report: CitizenIssue
  onClose: () => void
  onStatus: (id: string, status: IssueStatus, toast?: string) => void
  onCopyUlpin: (ulpin: string) => void
  onMailSent: (next: CitizenIssue[], disputeId: string) => void
}) {
  const priority = report.priority || 'medium'
  const msgCount = report.messages?.length || 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/75 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-[min(88vh,820px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + actions always visible */}
        <div className="flex-none border-b border-line px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-mute">{report.id}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(report.status)}`}
                >
                  {STATUS_LABEL[report.status]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[priority]}`}
                >
                  {priority}
                </span>
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-mute">
                  {msgCount} messages
                </span>
              </div>
              <h2 id="dispute-modal-title" className="font-display mt-1 text-[20px] font-semibold text-ink sm:text-[24px]">
                {report.category}
              </h2>
              <p className="mt-0.5 text-[12px] text-mute">
                {report.citizenName || 'Citizen'}
                {report.building ? ` · ${report.building}` : ''} ·{' '}
                {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-signal"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {report.status === 'new' && (
              <button
                type="button"
                onClick={() => onStatus(report.id, 'in_review', `${report.id} taken into review`)}
                className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                Take in review
              </button>
            )}
            {report.status !== 'closed' && (
              <button
                type="button"
                onClick={() => onStatus(report.id, 'closed', `${report.id} marked resolved`)}
                className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-1.5 text-[12px] font-semibold text-ok"
              >
                Resolve & close
              </button>
            )}
            {report.status === 'closed' && (
              <button
                type="button"
                onClick={() => onStatus(report.id, 'in_review', `${report.id} reopened`)}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink"
              >
                Reopen
              </button>
            )}
            <Link
              to={`/app/registry?q=${encodeURIComponent(report.ulpin)}`}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink"
            >
              Open Registry
            </Link>
            <Link
              to="/app/twin"
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink"
            >
              3D Atlas
            </Link>
            {report.category.toLowerCase().includes('underground') && (
              <Link
                to="/app/underground-properties"
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink"
              >
                UG Properties
              </Link>
            )}
            <button
              type="button"
              onClick={() => onCopyUlpin(report.ulpin)}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink"
            >
              Copy ULPIN
            </button>
          </div>
        </div>

        {/* Split: dossier | thread */}
        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1fr_1.15fr]">
          <div className="min-h-0 space-y-4 overflow-y-auto border-b border-line bg-paper px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['ULPIN', report.ulpin],
                ['Ward', report.ward || '—'],
                ['Assigned', report.assignedTo || 'Unassigned'],
                ['Citizen mail', report.citizenEmail || '—'],
                ['Contact', report.contact || '—'],
                ['Building', report.building || '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-white px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-mute">{k}</div>
                  <div className="mt-0.5 break-all text-[12px] font-semibold text-ink">{v}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-white px-4 py-3">
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Citizen claim</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{report.description}</p>
            </div>

            <div className="rounded-xl border border-line bg-white px-4 py-3">
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Operator summary</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                {report.adminSummary || 'No operator summary yet.'}
              </p>
              {report.evidenceNote && (
                <p className="mt-2 border-t border-line pt-2 text-[12px] leading-relaxed text-mute">
                  <span className="font-semibold text-ink">Evidence · </span>
                  {report.evidenceNote}
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden bg-white">
            <div className="flex-none border-b border-line px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-mute">
              Mail & chat · {msgCount}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <MessageThreadBody messages={report.messages || []} />
            </div>
            {report.status !== 'closed' ? (
              <div className="flex-none border-t border-line px-4 py-3">
                <ClarificationMailForm report={report} onSent={onMailSent} compact />
              </div>
            ) : (
              <div className="flex-none border-t border-line bg-paper px-4 py-2.5 text-[12px] text-mute">
                Case closed — reopen to send clarification mail.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageThreadBody({ messages }: { messages: DisputeMessage[] }) {
  if (!messages.length) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center text-center text-[13px] text-mute">
        No mail or chat yet. Send a clarification below.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => {
        const isAdmin = m.from === 'admin'
        const isSystem = m.from === 'system'
        return (
          <div
            key={m.id}
            className={`flex ${isAdmin ? 'justify-end' : isSystem ? 'justify-center' : 'justify-start'}`}
          >
            <div
              className={`max-w-[95%] rounded-xl px-3.5 py-2.5 sm:max-w-[85%] ${
                isSystem
                  ? 'border border-line bg-paper text-center text-[11px] text-mute'
                  : isAdmin
                    ? 'bg-ink text-white'
                    : 'border border-line bg-paper text-ink'
              }`}
            >
              {!isSystem && (
                <div
                  className={`mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.1em] ${
                    isAdmin ? 'text-white/60' : 'text-mute'
                  }`}
                >
                  <span>{isAdmin ? 'Operator' : 'Citizen'}</span>
                  <span>·</span>
                  <span>{m.channel === 'mail' ? 'Mail' : m.channel === 'chat' ? 'Chat' : 'Note'}</span>
                  <span>·</span>
                  <span className="normal-case tracking-normal">{new Date(m.at).toLocaleString()}</span>
                </div>
              )}
              {m.subject && (
                <div className={`mb-1 text-[12px] font-semibold ${isAdmin ? 'text-white' : 'text-ink'}`}>
                  {m.subject}
                </div>
              )}
              <p
                className={`whitespace-pre-wrap text-[13px] leading-relaxed ${
                  isSystem ? '' : isAdmin ? 'text-white/90' : 'text-ink'
                }`}
              >
                {m.body}
              </p>
              {m.channel === 'mail' && isAdmin && (
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ok">
                  Sent · delivered (mock)
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ClarificationMailForm({
  report,
  onSent,
  compact = false,
}: {
  report: CitizenIssue
  onSent: (next: CitizenIssue[], disputeId: string) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(`Clarification required · ${report.id}`)
  const [body, setBody] = useState(
    `Dear ${report.citizenName || 'Citizen'},\n\nWe are reviewing dispute ${report.id} (${report.category}) for ULPIN ${report.ulpin}.\n\nPlease reply with any supporting documents or clarifications so we can update the Registry / Atlas record.\n\n— VERTICA Operator · Ministry of Rural Development · DoLR`,
  )
  const [sending, setSending] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    window.setTimeout(() => {
      const next = sendClarificationMail(report.id, { subject, body })
      onSent(next, report.id)
      setSending(false)
      setOpen(false)
      setSubject(`Clarification required · ${report.id}`)
      setBody(
        `Dear ${report.citizenName || 'Citizen'},\n\nFollow-up on dispute ${report.id}.\n\n— VERTICA Operator · DoLR`,
      )
    }, 450)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full rounded-xl border border-signal/30 bg-signal-soft font-semibold text-signal-deep ${
          compact ? 'px-3 py-2.5 text-[12px]' : 'px-4 py-2.5 text-[13px]'
        }`}
      >
        Ask clarification · send mail to {report.citizenEmail || 'citizen'}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Compose mail</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold text-mute hover:text-ink"
        >
          Cancel
        </button>
      </div>
      <div className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[11px]">
        <span className="text-mute">To · </span>
        <span className="font-semibold text-ink">
          {report.citizenEmail || report.contact || 'citizen@inbox'}
        </span>
        <span className="mx-2 text-mute">·</span>
        <span className="text-mute">From · </span>
        <span className="font-semibold text-ink">operator@vertica.dolr.gov.in</span>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[12px] outline-none focus:border-signal"
      />
      <textarea
        required
        rows={compact ? 4 : 6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-[12px] outline-none focus:border-signal"
      />
      <button
        type="submit"
        disabled={sending || !body.trim()}
        className="rounded-xl bg-ink px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send mail to citizen'}
      </button>
    </form>
  )
}
