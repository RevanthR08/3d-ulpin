import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type IntelCityBuilding } from '../lib/api'
import { useAuth } from '../lib/auth'

export function RegistryPage() {
  const { selectUlpin } = useAuth()
  const [buildings, setBuildings] = useState<IntelCityBuilding[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    api.intelCity()
      .then((reg) => setBuildings(reg.buildings || []))
      .catch(() => setBuildings([]))
  }, [])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return buildings
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        b.ulpin.toLowerCase().includes(needle) ||
        b.id.toLowerCase().includes(needle) ||
        b.kind.toLowerCase().includes(needle),
    )
  }, [buildings, q])

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-6 px-7 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-ink">ULPIN registry</h1>
          <p className="mt-1 text-[14px] text-mute">
            Intel City building identities (replaces legacy Tower Alpha / Gamma society list).
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, kind, or ULPIN"
          className="w-full max-w-xs rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] outline-none focus:border-signal"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line bg-paper text-[11px] uppercase tracking-[0.12em] text-mute">
            <tr>
              <th className="px-5 py-3 font-medium">Building</th>
              <th className="px-5 py-3 font-medium">Kind</th>
              <th className="px-5 py-3 font-medium">Floors</th>
              <th className="px-5 py-3 font-medium">ULPIN</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-paper/80">
                <td className="px-5 py-3.5 font-semibold text-ink">{b.name}</td>
                <td className="px-5 py-3.5 text-mute">{b.kind}</td>
                <td className="px-5 py-3.5 text-mute">{b.floors?.length ?? 0}</td>
                <td className="font-mono px-5 py-3.5 text-[11px] text-signal">{b.ulpin}</td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => selectUlpin(b.floors?.[0]?.ulpin || b.ulpin)}
                    className="text-[12px] font-semibold text-ink hover:text-signal"
                  >
                    Select
                  </button>
                  <Link
                    to="/app/twin"
                    onClick={() => selectUlpin(b.floors?.[0]?.ulpin || b.ulpin)}
                    className="ml-3 text-[12px] font-semibold text-mute hover:text-signal"
                  >
                    3D
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-mute">
                  No buildings match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
