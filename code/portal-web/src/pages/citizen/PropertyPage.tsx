import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type UnitDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export function PropertyPage() {
  const { selectedUlpin, selectUlpin } = useAuth()
  const [query, setQuery] = useState(selectedUlpin || '')
  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(ulpin: string) {
    if (!ulpin.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.unit(ulpin.trim())
      setUnit(data)
      selectUlpin(ulpin.trim())
    } catch (e) {
      setUnit(null)
      setError('Unit not found in registry. Try a building or unit ULPIN from the map.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedUlpin) {
      setQuery(selectedUlpin)
      load(selectedUlpin)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    load(query)
  }

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Property identification</h1>
        <p className="mt-2 text-[14px] text-mute">
          Resolve a 3D ULPIN to ownership, floor position, and room layout metadata.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste ULPIN…"
          className="font-mono flex-1 rounded-xl border border-line bg-white px-4 py-3 text-[13px] outline-none focus:border-signal"
        />
        <button
          type="submit"
          className="rounded-xl bg-ink px-5 py-3 text-[13px] font-semibold text-white"
        >
          Resolve
        </button>
      </form>

      {loading && <div className="text-[13px] text-mute">Resolving…</div>}
      {error && <div className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-[13px] text-amber">{error}</div>}

      {unit && (
        <div className="panel-slide space-y-5 rounded-2xl border border-line bg-white p-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-mute">ULPIN</div>
            <div className="font-mono mt-1 text-[15px] text-signal break-all">{unit.ulpin}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-mute">Owner</div>
              <div className="text-[15px] font-semibold">{unit.owner || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Unit</div>
              <div className="text-[15px] font-semibold">{unit.unit ?? '—'}</div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Building</div>
              <div className="text-[15px] font-semibold">{unit.building_name || unit.building_id || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Floor</div>
              <div className="text-[15px] font-semibold">{unit.floor_label ?? '—'}</div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Area</div>
              <div className="text-[15px] font-semibold">
                {unit.area_sq_m != null ? `${unit.area_sq_m} m²` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-mute">Legal status</div>
              <div className="text-[15px] font-semibold">{unit.legal_status || 'registered'}</div>
            </div>
          </div>
          {unit.rooms && unit.rooms.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-mute">Rooms</div>
              <div className="flex flex-wrap gap-2">
                {unit.rooms.map((r, i) => (
                  <span
                    key={r.id || i}
                    className="rounded-full border border-line bg-paper px-3 py-1 text-[12px]"
                  >
                    {r.name || r.type || 'Room'}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Link to="/citizen/ownership" className="text-[13px] font-semibold text-signal">
              View ownership certificate →
            </Link>
            <a href="/viewer3d/" target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-mute">
              Open in 3D →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
