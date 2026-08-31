import { useEffect, useMemo, useState } from 'react'
import { api, type Dispute, type DisputeStatus } from '../../lib/api'

const ISSUE_LABEL: Record<string, string> = {
  boundary_dispute: 'Boundary dispute',
  ownership_error: 'Ownership error',
  encroachment_report: 'Encroachment report',
  other: 'Other',
}

const STATUS: Record<DisputeStatus, { label: string; tone: string }> = {
  pending_review: { label: 'Pending review', tone: 'bg-amber/15 text-amber' },
  approved: { label: 'Approved', tone: 'bg-ok/10 text-ok' },
  rejected: { label: 'Rejected', tone: 'bg-danger/10 text-danger' },
}

type Filter = 'all' | DisputeStatus

function countBy(disputes: Dispute[]) {
  return disputes.reduce(
    (acc, d) => {
      acc[d.status] += 1
      return acc
    },
    { pending_review: 0, approved: 0, rejected: 0 } as Record<DisputeStatus, number>,
  )
}

/** SVG of the auto-attached unit footprint polygon (local metres). */
function PolygonMini({ polygon }: { polygon: Array<[number, number]> }) {
  if (!polygon || polygon.length < 3) return null
  const xs = polygon.map((p) => p[0])
  const ys = polygon.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX || 1
  const h = Math.max(...ys) - minY || 1
  const pad = 4
  const pts = polygon
    .map(([x, y]) => `${pad + ((x - minX) / w) * 40},${pad + (1 - (y - minY) / h) * 40}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${40 + pad * 2} ${40 + pad * 2}`} className="h-16 w-16 flex-none">
      <polygon points={pts} fill="var(--color-signal-soft)" stroke="var(--color-signal-deep)" strokeWidth={1} />
    </svg>
  )
}

export function BackendDisputes() {
  const [disputes, setDisputes] = useState<Dispute[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    api
      .disputes()
      .then((res) => setDisputes(res.disputes))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])

  const counts = useMemo(() => (disputes ? countBy(disputes) : null), [disputes])
  const filtered = useMemo(
    () => (disputes ?? []).filter((d) => filter === 'all' || d.status === filter),
    [disputes, filter],
  )

  function applyReviewed(updated: Dispute) {
    setDisputes((prev) => (prev ?? []).map((d) => (d.dispute_id === updated.dispute_id ? updated : d)))
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-semibold text-ink">Filed disputes · one-tap</h2>
          <p className="mt-1 text-[13px] text-mute">
            From <code className="rounded bg-paper px-1 py-0.5 text-[11px]">GET /disputes</code> — geometry &amp;
            location auto-attached by the backend on filing.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-line">
          {(
            [
              ['all', 'All', disputes?.length ?? 0],
              ['pending_review', 'Pending', counts?.pending_review ?? 0],
              ['approved', 'Approved', counts?.approved ?? 0],
              ['rejected', 'Rejected', counts?.rejected ?? 0],
            ] as Array<[Filter, string, number]>
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3.5 py-2 text-[12px] font-semibold ${
                filter === key ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-paper-dim'
              }`}
            >
              {label} <span className={filter === key ? 'text-white/60' : 'text-mute'}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          Could not load disputes — {err}. Is the API on :8000?
        </div>
      )}
      {!disputes && !err && <div className="py-6 text-center text-[13px] text-mute">Loading disputes…</div>}

      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {filtered.map((d) => (
          <DisputeItem
            key={d.dispute_id}
            dispute={d}
            open={openId === d.dispute_id}
            onToggle={() => setOpenId((cur) => (cur === d.dispute_id ? null : d.dispute_id))}
            onReviewed={applyReviewed}
          />
        ))}
        {disputes && !filtered.length && (
          <div className="px-5 py-10 text-center text-[13px] text-mute">No disputes in this filter.</div>
        )}
      </div>
    </section>
  )
}

function DisputeItem({
  dispute,
  open,
  onToggle,
  onReviewed,
}: {
  dispute: Dispute
  open: boolean
  onToggle: () => void
  onReviewed: (d: Dispute) => void
}) {
  const [fetched, setFetched] = useState<Dispute | null>(null)
  const [reviewed, setReviewed] = useState<Dispute | null>(null)
  const [reviewerNote, setReviewerNote] = useState('')
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null)
  const [reviewErr, setReviewErr] = useState<string | null>(null)

  const detail = reviewed ?? fetched ?? dispute

  useEffect(() => {
    if (!open) return
    api
      .dispute(dispute.dispute_id)
      .then(setFetched)
      .catch(() => {})
  }, [open, dispute.dispute_id])

  const a = detail.auto_attached
  const st = STATUS[detail.status]

  async function review(action: 'approve' | 'reject') {
    setBusy(action)
    setReviewErr(null)
    try {
      const updated = await api.reviewDispute(dispute.dispute_id, action, reviewerNote)
      setReviewed(updated)
      onReviewed(updated)
    } catch (e) {
      setReviewErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-start justify-between gap-3 px-5 py-4 text-left hover:bg-paper/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-mute">{detail.dispute_id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${st.tone}`}>
              {st.label}
            </span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-mute">
              {ISSUE_LABEL[detail.issue_type] ?? detail.issue_type}
            </span>
          </div>
          <div className="mt-1.5 text-[14px] font-semibold text-ink">
            {a.building_name ?? '—'}
            {a.floor_label ? ` · Floor ${a.floor_label}` : ''}
            {a.unit ? ` · Unit ${a.unit}` : ''}
          </div>
          <div className="font-mono mt-0.5 text-[11px] text-signal-deep">{detail.ulpin}</div>
          {detail.note && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-mute">“{detail.note}”</p>
          )}
        </div>
        <div className="text-[11px] text-mute">{new Date(detail.filed_at).toLocaleString()}</div>
      </button>

      {open && (
        <div className="border-t border-line bg-paper px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['Owner', a.owner ?? '—'],
                  ['Type', a.property_type ?? '—'],
                  ['Area', a.area_sq_m != null ? `${a.area_sq_m} m²` : '—'],
                  [
                    'Vertical extent',
                    a.vertical_extent_m
                      ? `${a.vertical_extent_m.base ?? '?'} – ${a.vertical_extent_m.top ?? '?'} m`
                      : '—',
                  ],
                  [
                    'GPS',
                    a.gps?.latitude != null
                      ? `${a.gps.latitude.toFixed(5)}, ${a.gps.longitude?.toFixed(5)}`
                      : '—',
                  ],
                  ['Level', detail.level],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line bg-white px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-mute">{k}</div>
                  <div className="mt-0.5 break-all text-[12px] font-semibold text-ink">{v}</div>
                </div>
              ))}
            </div>
            {a.unit_polygon_m && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-white px-3 py-2">
                <PolygonMini polygon={a.unit_polygon_m} />
                <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-mute">Auto-attached footprint</div>
              </div>
            )}
          </div>

          {detail.status !== 'pending_review' ? (
            <div className="mt-3 rounded-lg border border-line bg-white px-3 py-2 text-[12px] text-mute">
              <span className={`font-semibold ${detail.status === 'approved' ? 'text-ok' : 'text-danger'}`}>
                {st.label}
              </span>
              {detail.reviewed_at ? ` · ${new Date(detail.reviewed_at).toLocaleString()}` : ''}
              {detail.reviewer_note ? ` · “${detail.reviewer_note}”` : ''}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                rows={2}
                placeholder="Reviewer note (optional)"
                className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[12px] outline-none focus:border-signal"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => review('approve')}
                  className="rounded-lg border border-ok/30 bg-ok/10 px-3.5 py-2 text-[12px] font-semibold text-ok disabled:opacity-50"
                >
                  {busy === 'approve' ? 'Approving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => review('reject')}
                  className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2 text-[12px] font-semibold text-danger disabled:opacity-50"
                >
                  {busy === 'reject' ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
              {reviewErr && <div className="text-[11px] text-danger">Review failed — {reviewErr}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
