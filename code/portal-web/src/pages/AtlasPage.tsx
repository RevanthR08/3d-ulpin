import { useSearchParams } from 'react-router-dom'
import { PolygonViewerPage } from './PolygonViewerPage'
import { TwinViewerPage } from './TwinViewerPage'

type View = '2d' | '3d'

const VIEWS: Array<readonly [View, string]> = [
  ['2d', '2D · City Atlas'],
  ['3d', '3D · Atlas'],
]

/**
 * Atlas — City Atlas (2D GBA) and 3D Atlas (Intel City twin) behind one nav
 * entry with a 2D/3D toggle. Each viewer page is rendered untouched.
 */
export function AtlasPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === '3d' ? '3d' : '2d'

  function setView(next: View) {
    const p = new URLSearchParams(params)
    if (next === '2d') p.delete('view')
    else p.set('view', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="page-enter flex h-full min-h-0 flex-col bg-paper-dim">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-7 py-3">
        <h1 className="font-display text-[16px] font-semibold text-ink">Atlas</h1>
        <div className="flex overflow-hidden rounded-xl border border-line bg-white">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`px-4 py-2.5 text-[12px] font-semibold ${
                view === id ? 'bg-ink text-white' : 'text-ink hover:bg-paper-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === '2d' ? <PolygonViewerPage /> : <TwinViewerPage />}
      </div>
    </div>
  )
}
