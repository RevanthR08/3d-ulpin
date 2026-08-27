import { useState } from 'react'
import { Link } from 'react-router-dom'
import labeledPolygons from '../../assets/labeled_polygons.jpeg'
import satelliteBase from '../../assets/satellite_base.jpg'

type ViewMode = 'satellite' | 'labels' | 'compare'

function ImagePane({
  src,
  alt,
  caption,
}: {
  src: string
  alt: string
  caption: string
}) {
  return (
    <figure className="flex min-h-0 flex-1 flex-col overflow-hidden border border-line bg-ink">
      <div className="flex-none border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-white/55">
        {caption}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#0B1210]">
        <img src={src} alt={alt} className="block h-auto w-full object-contain" />
      </div>
    </figure>
  )
}

/** Admin: satellite base + manually labeled 2D building polygons (P# vertices). */
export function PolygonLabelsPage() {
  const [mode, setMode] = useState<ViewMode>('compare')

  return (
    <div className="page-enter flex h-full min-h-[calc(100vh-3.5rem)] flex-col bg-paper-dim">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-7 py-3">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-semibold text-ink">2D Polygon Labels</h1>
          <p className="mt-0.5 text-[12px] text-mute">
            Satellite orthophoto + verified footprint polygons (P# vertices)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-line bg-white">
            {(
              [
                ['satellite', 'Satellite'],
                ['labels', 'Labeled'],
                ['compare', 'Compare'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`px-3.5 py-2 text-[12px] font-semibold ${
                  mode === id ? 'bg-ink text-white' : 'text-ink hover:bg-paper-dim'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Link
            to="/app/polygons"
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12px] font-semibold text-ink"
          >
            City Atlas
          </Link>
          <Link
            to="/app/processing"
            className="rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-white"
          >
            AI Pipeline
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-3">
        {mode === 'compare' ? (
          <div className="grid h-full min-h-[520px] gap-3 lg:grid-cols-2">
            <ImagePane src={satelliteBase} alt="Satellite orthophoto" caption="Satellite image" />
            <ImagePane
              src={labeledPolygons}
              alt="Labeled building polygons"
              caption="Labeled polygons · P# vertices"
            />
          </div>
        ) : mode === 'satellite' ? (
          <div className="h-full min-h-[520px]">
            <ImagePane src={satelliteBase} alt="Satellite orthophoto" caption="Satellite image" />
          </div>
        ) : (
          <div className="h-full min-h-[520px]">
            <ImagePane
              src={labeledPolygons}
              alt="Labeled building polygons"
              caption="Labeled polygons · P# vertices"
            />
          </div>
        )}
      </div>
    </div>
  )
}
