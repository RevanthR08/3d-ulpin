import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCitizenTickets } from '../lib/tickets'
import type { CitizenIssue, IssueStatus } from '../lib/storage'

const STATUS_LABEL: Record<IssueStatus, string> = {
  new: 'Raised',
  in_review: 'In review',
  closed: 'Closed',
}

function statusTone(status: IssueStatus) {
  if (status === 'new') return 'bg-amber/15 text-amber'
  if (status === 'in_review') return 'bg-signal-soft text-signal-deep'
  return 'bg-ok/10 text-ok'
}

function TicketCard({
  ticket,
  active,
  onPick,
}: {
  ticket: CitizenIssue
  active: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full rounded-xl border px-4 py-3 text-left ${
        active ? 'border-signal bg-signal-soft/60' : 'border-line bg-white hover:border-signal'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-mute">{ticket.id}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(ticket.status)}`}>
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>
      <div className="mt-1 text-[13px] font-semibold text-ink">{ticket.category}</div>
      <div className="mt-0.5 text-[11px] text-mute">
        {ticket.building || 'Parcel'} · {new Date(ticket.createdAt).toLocaleDateString()}
      </div>
    </button>
  )
}

export function CitizenTicketsPanel() {
  const { open, highlightId, tickets, closePanel } = useCitizenTickets()
  const [selectedId, setSelectedId] = useState<string | null>(highlightId)

  useEffect(() => {
    if (open) setSelectedId(highlightId || tickets[0]?.id || null)
  }, [open, highlightId, tickets])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePanel])

  if (!open) return null

  const selected = tickets.find((t) => t.id === selectedId) || tickets[0] || null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close tickets"
        className="absolute inset-0 bg-ink/40"
        onClick={closePanel}
      />
      <aside className="panel-slide relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-paper shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Raised tickets</div>
            <h2 className="font-display mt-1 text-[22px] font-semibold text-ink">
              {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-signal"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tickets.length === 0 ? (
            <div className="rounded-xl border border-line bg-white px-4 py-10 text-center text-[13px] text-mute">
              No tickets on this account yet. Submit a report to raise one.
            </div>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <TicketCard
                    ticket={t}
                    active={t.id === selected?.id}
                    onPick={() => setSelectedId(t.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div className="mt-5 space-y-3 rounded-2xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] font-semibold text-signal">{selected.id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(selected.status)}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <div className="text-[15px] font-semibold text-ink">{selected.category}</div>
              <p className="text-[13px] leading-relaxed text-mute">{selected.description}</p>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="text-mute">Building</div>
                  <div className="font-semibold text-ink">{selected.building || '—'}</div>
                </div>
                <div>
                  <div className="text-mute">Assigned</div>
                  <div className="font-semibold text-ink">{selected.assignedTo || 'Unassigned'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-mute">ULPIN</div>
                  <div className="font-mono break-all text-signal">{selected.ulpin}</div>
                </div>
              </div>
              {selected.adminSummary && (
                <div className="rounded-xl bg-paper px-3 py-2 text-[12px] leading-relaxed text-mute">
                  {selected.adminSummary}
                </div>
              )}
              {(selected.messages || []).length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Thread</div>
                  <ul className="mt-2 space-y-2">
                    {(selected.messages || []).slice(-4).map((m) => (
                      <li key={m.id} className="rounded-lg border border-line bg-paper px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-mute">
                          {m.from} · {m.channel} · {new Date(m.at).toLocaleString()}
                        </div>
                        {m.subject && <div className="mt-0.5 text-[12px] font-semibold text-ink">{m.subject}</div>}
                        <div className="mt-0.5 text-[12px] text-mute">{m.body}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
