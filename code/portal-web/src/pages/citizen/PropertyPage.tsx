import { useEffect, useState } from 'react'
import { CitizenPropertyList } from '../../components/CitizenPropertyList'
import { api, resolveIntelCityUnit, type UnitDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ownedProperties } from '../../lib/demoAccounts'

export function PropertyPage() {
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
        for (const h of holdings) {
          next[h.ulpin] = resolveIntelCityUnit(reg, h.ulpin)
        }
        setDetails(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // holdings is derived from selectedUlpin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUlpin])

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">My Property</h1>
        <p className="mt-2 text-[14px] text-mute">
          All parcels on this citizen account — location, floor, and cadastral metadata.
        </p>
      </div>

      <CitizenPropertyList holdings={holdings} details={details} variant="detail" />
    </div>
  )
}
