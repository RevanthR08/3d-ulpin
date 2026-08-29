import { useSearchParams } from 'react-router-dom'
import { IngestPage } from './IngestPage'
import { PolygonLabelsPage } from './PolygonLabelsPage'
import { ProcessingPage } from './ProcessingPage'

type Tab = 'ingest' | 'processing' | 'labels'

const TABS: Array<readonly [Tab, string]> = [
  ['ingest', 'Data Ingestion'],
  ['processing', 'AI Pipeline'],
  ['labels', '2D Polygon Labels'],
]

/**
 * Data & AI Pipeline — the linear handoff chain (ingest → process → 2D labels)
 * behind one nav entry. Each step keeps its own page untouched; this only adds
 * the tab strip that swaps between them.
 */
export function DataPipelinePage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'processing' || raw === 'labels' ? raw : 'ingest'

  function setTab(next: Tab) {
    const p = new URLSearchParams(params)
    if (next === 'ingest') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="page-enter flex h-full min-h-0 flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-7 py-3">
        <h1 className="font-display text-[16px] font-semibold text-ink">Data &amp; AI Pipeline</h1>
        <div className="flex overflow-hidden rounded-xl border border-line bg-white">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-[12px] font-semibold ${
                tab === id ? 'bg-ink text-white' : 'text-ink hover:bg-paper-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'ingest' && <IngestPage />}
        {tab === 'processing' && <ProcessingPage />}
        {tab === 'labels' && <PolygonLabelsPage />}
      </div>
    </div>
  )
}
