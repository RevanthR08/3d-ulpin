import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl'
import type { Map } from 'maplibre-gl'
import { Link } from 'react-router-dom'
import { api, type GeoSitePlan } from '../lib/api'
import { useAuth } from '../lib/auth'

const TYPE_COLOR: Record<string, string> = {
  residential_tower: '#0C8F7C',
  residential_midrise: '#0C8F7C',
  low_rise_residential: '#0C8F7C',
  community_facility: '#5b6b8c',
  utility_facility: '#c4841d',
}

function toLngLat(latlon: [number, number]): [number, number] {
  return [latlon[1], latlon[0]]
}

function ringLngLat(points: Array<[number, number]>) {
  const r = points.map(toLngLat)
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) {
    r.push(r[0])
  }
  return r
}

type Selected = {
  id: string
  name: string
  ulpin: string
  height?: number
  type?: string
}

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const { selectUlpin, selectedUlpin } = useAuth()
  const [selected, setSelected] = useState<Selected | null>(null)
  const [stats, setStats] = useState<string>('Loading…')
  const [error, setError] = useState<string | null>(null)
  const [localOnly, setLocalOnly] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: Map | null = null

    async function boot() {
      if (!containerRef.current) return
      try {
        const [plan, society] = await Promise.all([
          api.geoSitePlan(),
          api.society(),
        ])
        if (cancelled) return

        const isLocal = society.meta?.data_type === 'local_xy_demo' || !plan?.buildings?.length
        setLocalOnly(isLocal)

        const totals = society.computed_totals || society.declared_totals
        setStats(
          `${totals?.total_buildings ?? plan.buildings?.length ?? 0} buildings · ${totals?.total_units ?? '—'} units`,
        )

        const heightByBuilding: Record<string, number> = {}
        await Promise.all(
          (plan.buildings || []).slice(0, 40).map(async (b) => {
            try {
              const detail = (await api.building(b.id)) as {
                vertical_parcel?: { top_elevation_m?: number; base_elevation_m?: number }
                height?: { total_m?: number }
              }
              const h =
                detail.height?.total_m ??
                (detail.vertical_parcel
                  ? (detail.vertical_parcel.top_elevation_m || 0) -
                    (detail.vertical_parcel.base_elevation_m || 0)
                  : 20)
              heightByBuilding[b.id] = h || 20
            } catch {
              heightByBuilding[b.id] = 20
            }
          }),
        )

        if (!containerRef.current || cancelled) return

        map = new MapLibreMap({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              carto: {
                type: 'raster',
                tiles: [
                  'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                  'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                ],
                tileSize: 256,
                attribution: '© OSM © CARTO',
              },
            },
            layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
          },
          center: [plan.origin?.longitude ?? 77.59, plan.origin?.latitude ?? 12.97],
          zoom: 17.2,
          pitch: 52,
          bearing: -18,
        })
        mapRef.current = map
        if (!map) return
        const live: Map = map
        live.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')

        live.on('load', () => {
          addPlanLayers(live, plan, heightByBuilding)

          live.on('click', 'buildings-3d', (e) => {
            const f = e.features?.[0]
            if (!f?.properties) return
            const p = f.properties as Selected
            setSelected({
              id: String(p.id),
              name: String(p.name),
              ulpin: String(p.ulpin),
              height: Number(p.height),
              type: String(p.type || ''),
            })
            selectUlpin(String(p.ulpin))
          })
          live.on('mouseenter', 'buildings-3d', () => {
            live.getCanvas().style.cursor = 'pointer'
          })
          live.on('mouseleave', 'buildings-3d', () => {
            live.getCanvas().style.cursor = ''
          })
        })
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message || e))
      }
    }

    boot()
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
    }
  }, [selectUlpin])

  useEffect(() => {
    if (!selected && selectedUlpin) {
      setSelected((prev) => prev || { id: '', name: 'Selected parcel', ulpin: selectedUlpin })
    }
  }, [selectedUlpin, selected])

  return (
    <div className="relative h-full min-h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-paper-dim">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-sm">
        <div className="pointer-events-auto rounded-2xl border border-line/80 bg-white/92 px-4 py-3 shadow-lg backdrop-blur">
          <div className="font-display text-[18px] font-semibold text-ink">Parcel map</div>
          <div className="mt-0.5 text-[12px] text-mute">{stats}</div>
          {localOnly && (
            <div className="mt-2 text-[11px] leading-relaxed text-amber">
              Local-XY demo dataset — basemap may not align. Use Intel City twin for volumetric parcels.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="absolute bottom-6 left-5 z-10 max-w-md rounded-xl border border-danger/30 bg-white px-4 py-3 text-[13px] text-danger shadow">
          {error}
        </div>
      )}

      {selected && (
        <div className="panel-slide absolute bottom-6 right-5 z-10 w-[320px] rounded-2xl border border-line bg-white/95 p-5 shadow-2xl backdrop-blur">
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Selected volume</div>
          <div className="mt-1 text-[17px] font-semibold text-ink">{selected.name}</div>
          <div className="font-mono mt-2 text-[11px] text-signal break-all">{selected.ulpin}</div>
          {selected.height != null && (
            <div className="mt-3 text-[12px] text-mute">Approx. height · {selected.height.toFixed(1)} m</div>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Link
              to="/citizen/property"
              className="rounded-xl bg-ink py-2.5 text-center text-[13px] font-semibold text-white"
            >
              My Property
            </Link>
            <Link
              to="/citizen/record"
              className="rounded-xl border border-line py-2.5 text-center text-[13px] font-semibold"
            >
              Property Record
            </Link>
            <Link
              to="/app/polygons"
              className="rounded-xl border border-signal/25 bg-signal-soft py-2.5 text-center text-[13px] font-semibold text-signal-deep"
            >
              3D Property Viewer
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function addPlanLayers(
  map: Map,
  plan: GeoSitePlan,
  heightByBuilding: Record<string, number>,
) {
  if (plan.green_boundary?.length) {
    map.addSource('green', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [ringLngLat(plan.green_boundary)] },
      },
    })
    map.addLayer({
      id: 'green',
      type: 'fill',
      source: 'green',
      paint: { 'fill-color': '#a9c98a', 'fill-opacity': 0.45 },
    })
  }

  if (plan.roads?.length) {
    map.addSource('roads', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: plan.roads.map((r) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: r.points.map(toLngLat) },
        })),
      },
    })
    map.addLayer({
      id: 'roads',
      type: 'line',
      source: 'roads',
      paint: { 'line-color': '#8b8570', 'line-width': 5, 'line-opacity': 0.85 },
    })
  }

  const buildingFeatures = (plan.buildings || []).map((b) => ({
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [ringLngLat(b.polygon)] },
    properties: {
      id: b.id,
      name: b.name,
      ulpin: b.ulpin,
      type: b.type || '',
      color: TYPE_COLOR[b.type || ''] || '#0C8F7C',
      height: heightByBuilding[b.id] || 20,
    },
  }))

  map.addSource('buildings', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: buildingFeatures },
  })
  map.addLayer({
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'buildings',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.92,
    },
  })
}
