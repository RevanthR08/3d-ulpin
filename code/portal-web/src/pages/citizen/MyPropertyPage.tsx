import { useSearchParams } from 'react-router-dom'
import { OwnershipPage } from './OwnershipPage'
import { PropertyPage } from './PropertyPage'
import { UndergroundPage } from './UndergroundPage'

type Tab = 'occupancy' | 'ownership' | 'connections'

const TABS: Array<readonly [Tab, string]> = [
  ['occupancy', 'Occupancy'],
  ['ownership', 'Ownership'],
  ['connections', 'Connections'],
]

/**
 * My Property — occupancy, ownership/title, and underground service
 * connections for the citizen's holdings behind one nav entry. Each view is
 * rendered untouched; this only adds the tab strip that swaps between them.
 */
export function MyPropertyPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'ownership' || raw === 'connections' ? raw : 'occupancy'

  function setTab(next: Tab) {
    const p = new URLSearchParams(params)
    if (next === 'occupancy') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="page-enter flex h-full min-h-0 flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-7 py-3">
        <h1 className="font-display text-[16px] font-semibold text-ink">My Property</h1>
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
        {tab === 'occupancy' && <PropertyPage />}
        {tab === 'ownership' && <OwnershipPage />}
        {tab === 'connections' && <UndergroundPage />}
      </div>
    </div>
  )
}
