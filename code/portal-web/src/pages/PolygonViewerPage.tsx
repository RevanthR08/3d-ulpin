import { Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl'
import type { Map } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'

const GBA_URL = 'https://tubvsig-so2sat-vm1.srv.mwn.de/#15/13.0827/80.2707'
const LABELED_GEOJSON = `${import.meta.env.BASE_URL}data/chennai_tnagar_block_a.geojson`
const TERMS_KEY = 'vertica_gba_terms_ack'

type Mode = 'labels' | 'gba'

type BuildingProps = {
  id?: string
  name?: string
  label?: string
  landuse?: string
  typology?: string
  simulated_floors?: number
  height_m?: number
  kind?: string
}

const LANDUSE_COLOR: Record<string, string> = {
  residential: '#0C8F7C',
  commercial: '#c4841d',
  mixed: '#2f6fed',
  community: '#5b6b8c',
  utility: '#6b736e',
}

const TYPOLOGY_COLOR: Record<string, string> = {
  villa: '#3d8b6e',
  apartment: '#0C8F7C',
  highrise: '#1a5f9e',
}

function readTermsAck() {
  try {
    return localStorage.getItem(TERMS_KEY) === '1'
  } catch {
    return false
  }
}

export function PolygonViewerPage() {
  const { selectUlpin } = useAuth()
  const [mode, setMode] = useState<Mode>('labels')
  const [termsAck, setTermsAck] = useState(readTermsAck)
  const [selected, setSelected] = useState<BuildingProps | null>(null)
  const [status, setStatus] = useState('Loading Chennai labels…')
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)

  // Always boot the map in a visible container (same pattern as Parcel Map).
  // GBA is only an overlay — never hide the map with opacity-0.
  useEffect(() => {
    let cancelled = false
    let map: Map | null = null
    let popup: Popup | null = null

    async function boot() {
      const el = containerRef.current
      if (!el) return

      // Wait until layout has real pixels (flex shells can be 0×0 for a frame).
      for (let i = 0; i < 20; i++) {
        if (el.clientWidth > 10 && el.clientHeight > 10) break
        await new Promise((r) => requestAnimationFrame(r))
      }
      if (cancelled || !containerRef.current) return

      setError(null)
      setStatus('Loading Chennai labels…')
      const res = await fetch(LABELED_GEOJSON)
      if (!res.ok) throw new Error(`GeoJSON HTTP ${res.status}`)
      const gj = await res.json()
      if (cancelled || !containerRef.current) return

      const all = (gj.features || []) as Array<{
        type: string
        properties: BuildingProps
        geometry: { type: string; coordinates: unknown }
      }>
      const buildings = all.filter((f) => f.properties?.kind === 'building')
      const roads = all.filter((f) => f.properties?.kind === 'road')
      const site = all.filter((f) => f.properties?.kind === 'site_boundary')

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
        center: [80.233, 13.0415],
        zoom: 16.4,
        pitch: 45,
        bearing: -12,
      })
      mapRef.current = map
      const live = map
      live.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')

      live.on('load', () => {
        if (cancelled) return

        live.addSource('site', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: site },
        })
        live.addLayer({
          id: 'site-fill',
          type: 'fill',
          source: 'site',
          paint: { 'fill-color': '#0C8F7C', 'fill-opacity': 0.08 },
        })
        live.addLayer({
          id: 'site-line',
          type: 'line',
          source: 'site',
          paint: { 'line-color': '#0C8F7C', 'line-width': 2, 'line-dasharray': [2, 1] },
        })

        live.addSource('roads', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: roads },
        })
        live.addLayer({
          id: 'roads-line',
          type: 'line',
          source: 'roads',
          paint: { 'line-color': '#4a5560', 'line-width': 3.5, 'line-opacity': 0.85 },
        })

        const bld = {
          type: 'FeatureCollection' as const,
          features: buildings.map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              color:
                TYPOLOGY_COLOR[f.properties.typology || ''] ||
                LANDUSE_COLOR[f.properties.landuse || ''] ||
                '#0C8F7C',
              height: Number(f.properties.height_m) || (Number(f.properties.simulated_floors) || 3) * 3,
            },
          })),
        }
        live.addSource('buildings', { type: 'geojson', data: bld })
        live.addLayer({
          id: 'buildings-fill',
          type: 'fill-extrusion',
          source: 'buildings',
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
          },
        })

        live.on('click', 'buildings-fill', (e) => {
          const f = e.features?.[0]
          if (!f?.properties) return
          const p = f.properties as BuildingProps
          setSelected(p)
          if (p.id) selectUlpin(String(p.id))
          popup?.remove()
          popup = new Popup({ offset: 12, closeButton: false })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font:12px/1.4 DM Sans,sans-serif"><b>${p.name || p.id}</b><br/><span style="color:#0C8F7C;font-family:monospace;font-size:11px">${p.id}</span><br/>${p.label || p.typology || ''} · ${p.simulated_floors || '?'}F</div>`,
            )
            .addTo(live)
        })

        const coords: number[][] = []
        site.forEach((f) => {
          const ring = (f.geometry as { coordinates?: number[][][] })?.coordinates?.[0]
          ring?.forEach((c) => coords.push(c))
        })
        if (coords.length) {
          let minX = coords[0][0]
          let minY = coords[0][1]
          let maxX = coords[0][0]
          let maxY = coords[0][1]
          coords.forEach(([x, y]) => {
            minX = Math.min(minX, x)
            maxX = Math.max(maxX, x)
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)
          })
          live.fitBounds(
            [
              [minX, minY],
              [maxX, maxY],
            ],
            { padding: 60, duration: 0 },
          )
        }

        live.resize()
        setStatus(
          `Chennai T. Nagar · ${buildings.length} buildings · ${roads.length} roads`,
        )
      })
    }

    boot().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load labels')
      setStatus('Load failed')
    })

    return () => {
      cancelled = true
      popup?.remove()
      map?.remove()
      mapRef.current = null
    }
  }, [selectUlpin])

  useEffect(() => {
    if (mode !== 'labels') return
    const id = window.setTimeout(() => {
      mapRef.current?.resize()
      mapRef.current?.triggerRepaint()
    }, 60)
    return () => clearTimeout(id)
  }, [mode])

  function ackTerms() {
    localStorage.setItem(TERMS_KEY, '1')
    setTermsAck(true)
  }

  return (
    <div className="relative h-full min-h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-paper-dim">
      {/* Map always mounted and visible — never opacity-0 */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute left-5 top-5 z-20 max-w-sm">
        <div className="pointer-events-auto rounded-2xl border border-line/80 bg-white/92 px-4 py-3 shadow-lg backdrop-blur">
          <div className="font-display text-[18px] font-semibold text-ink">Our labels</div>
          <div className="mt-0.5 text-[12px] text-mute">{status}</div>
          {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}
        </div>
      </div>

      {selected && mode === 'labels' && (
        <div className="panel-slide absolute bottom-16 right-5 z-20 w-[280px] rounded-2xl border border-line bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Chennai parcel</div>
          <div className="mt-1 text-[15px] font-semibold text-ink">{selected.name}</div>
          <div className="font-mono mt-1 text-[11px] text-signal break-all">{selected.id}</div>
          <div className="mt-2 text-[12px] text-mute">
            {selected.label || selected.typology} · {selected.simulated_floors}F · {selected.height_m}m
          </div>
        </div>
      )}

      {/* External atlas as overlay only */}
      {mode === 'gba' && (
        <div className="absolute inset-0 z-30 flex flex-col bg-ink">
          {!termsAck ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
              <div className="font-display text-[28px] font-semibold text-white">Building atlas</div>
              <p className="max-w-md text-[14px] leading-relaxed text-white/55">
                First visit only — agree to the external atlas terms once.
              </p>
              <button
                type="button"
                onClick={ackTerms}
                className="rounded-xl bg-signal px-6 py-3 text-[13px] font-semibold text-white hover:bg-signal-deep"
              >
                Continue
              </button>
            </div>
          ) : (
            <iframe
              title="Global building atlas"
              src={GBA_URL}
              className="h-full w-full flex-1 border-0 bg-white"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
            />
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 overflow-hidden rounded-full border border-line bg-white/95 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={() => setMode('labels')}
          className={`px-3.5 py-1.5 text-[11px] font-semibold ${
            mode === 'labels' ? 'bg-ink text-white' : 'text-ink hover:bg-paper-dim'
          }`}
        >
          Our labels
        </button>
        <button
          type="button"
          onClick={() => setMode('gba')}
          className={`px-3.5 py-1.5 text-[11px] font-semibold ${
            mode === 'gba' ? 'bg-ink text-white' : 'text-ink hover:bg-paper-dim'
          }`}
        >
          Building atlas
        </button>
      </div>
    </div>
  )
}
