import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CitizenPropertyList } from '../../components/CitizenPropertyList'
import { api, resolveIntelCityUnit, type UnitDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ownedProperties } from '../../lib/demoAccounts'

export function PropertyRecordPage() {
  const { selectedUlpin } = useAuth()
  const holdings = selectedUlpin ? ownedProperties(selectedUlpin) : []
  const [details, setDetails] = useState<Record<string, UnitDetail | null>>({})

  useEffect(() => {
    if (holdings.length === 0) return
    let cancelled = false
    api
      .intelCity()
      .then((reg) => {
        if (cancelled) return
        const next: Record<string, UnitDetail | null> = {}
        for (const h of holdings) next[h.ulpin] = resolveIntelCityUnit(reg, h.ulpin)
        setDetails(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUlpin])

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Property Record</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Official cadastral records for every parcel/body/floor identity on this account.
        </p>
      </div>

      {holdings.length > 0 ? (
        <CitizenPropertyList holdings={holdings} details={details} variant="record" />
      ) : (
        <div className="rounded-2xl border border-line bg-white py-12 text-center text-[13px] text-mute">
          No properties on this citizen session.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/app/registry" className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold">
          Open registry
        </Link>
        <Link to="/app/twin" className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white">
          Open 3D Atlas
        </Link>
      </div>
    </div>
  )
}
