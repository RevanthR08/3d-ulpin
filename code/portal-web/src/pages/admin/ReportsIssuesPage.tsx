import { useEffect, useState } from 'react'
import {
  getIssueReports,
  updateIssueReportStatus,
  type CitizenIssue,
  type IssueStatus,
} from '../../lib/storage'

const STATUS_LABEL: Record<IssueStatus, string> = {
  new: 'New',
  in_review: 'In review',
  closed: 'Closed',
}

export function ReportsIssuesPage() {
  const [reports, setReports] = useState<CitizenIssue[]>([])

  useEffect(() => {
    setReports(getIssueReports())
  }, [])

  function setStatus(id: string, status: IssueStatus) {
    setReports(updateIssueReportStatus(id, status))
  }

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Reports / Issues</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Citizen-submitted record issues collected for government review. Formal dispute
          resolution is marked as future production scope.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(['new', 'in_review', 'closed'] as IssueStatus[]).map((status) => (
          <div key={status} className="rounded-2xl border border-line bg-white px-5 py-4">
            <div className="font-display text-[28px] font-semibold text-ink">
              {reports.filter((r) => r.status === status).length}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">
              {STATUS_LABEL[status]}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-mute">
          Review queue
        </div>
        <div className="divide-y divide-line">
          {reports.map((report) => (
            <div key={report.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-ink">{report.category}</div>
                  <div className="font-mono mt-1 text-[11px] text-signal break-all">{report.ulpin}</div>
                </div>
                <select
                  value={report.status}
                  onChange={(e) => setStatus(report.id, e.target.value as IssueStatus)}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-[12px]"
                >
                  <option value="new">New</option>
                  <option value="in_review">In review</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <p className="text-[13px] leading-relaxed text-mute">{report.description}</p>
              <div className="text-[11px] text-mute">
                {new Date(report.createdAt).toLocaleString()} {report.contact ? `· ${report.contact}` : ''}
              </div>
            </div>
          ))}
          {!reports.length && (
            <div className="px-5 py-12 text-center text-[13px] text-mute">
              No citizen reports yet. Submit one from Citizen → Report an Issue.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
