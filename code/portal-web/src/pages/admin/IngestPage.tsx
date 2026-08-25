import { useState } from 'react'

const SOURCES = [
  { id: 'drone', label: 'Drone / aerial imagery', formats: 'GeoTIFF · JPG · PNG' },
  { id: 'lidar', label: 'LiDAR / point cloud', formats: 'LAS · LAZ · PLY' },
  { id: 'gis', label: 'GIS parcel layers', formats: 'GeoJSON · Shapefile · GPKG' },
  { id: 'plans', label: 'Building floor plans', formats: 'PDF · DXF · SVG' },
  { id: 'gnss', label: 'GNSS / CORS coordinates', formats: 'CSV · NMEA · JSON' },
  { id: 'dem', label: 'DEM / DSM elevation', formats: 'GeoTIFF · ASC' },
]

export function IngestPage() {
  const [files, setFiles] = useState<Record<string, File | null>>({})

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Data ingestion</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Six sensing inputs from the vertical property mapping brief. Drop files to stage a
          survey package — drone extraction can run through the existing footprint tool.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((s) => {
          const f = files[s.id]
          return (
            <label
              key={s.id}
              className="group cursor-pointer rounded-2xl border border-dashed border-line bg-white p-5 transition hover:border-signal hover:bg-signal-soft/30"
            >
              <input
                type="file"
                className="hidden"
                onChange={(e) =>
                  setFiles((prev) => ({ ...prev, [s.id]: e.target.files?.[0] || null }))
                }
              />
              <div className="text-[14px] font-semibold text-ink">{s.label}</div>
              <div className="mt-1 font-mono text-[11px] text-mute">{s.formats}</div>
              <div className="mt-4 rounded-xl bg-paper-dim/80 px-3 py-3 text-[12px] text-mute group-hover:bg-white">
                {f ? (
                  <span className="font-mono font-medium text-signal">{f.name}</span>
                ) : (
                  'Drop or browse to attach'
                )}
              </div>
            </label>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-line bg-ink px-6 py-4 text-white">
        <div>
          <div className="text-[14px] font-semibold">
            {Object.values(files).filter(Boolean).length} / {SOURCES.length} sources staged
          </div>
          <div className="text-[12px] text-white/45">Demo staging — full parse reserved for production stack</div>
        </div>
        <a
          href="/extract/"
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-signal px-4 py-2.5 text-[13px] font-semibold hover:bg-signal-deep"
        >
          Open footprint tool
        </a>
      </div>
    </div>
  )
}
