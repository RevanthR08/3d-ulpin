import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import verifiedMarkedPolygons from '../../assets/verified_marked_polygons.png'
import { PipelineStrip } from '../../components/PipelineStrip'

const STEP_MS = 4800

const TERMINAL_SCRIPT: Array<{ at: number; lines: string[] }> = [
  {
    at: 0,
    lines: [
      '$ vertica pipeline run --package survey_chennai_block.zip',
      '[init] loading staged survey package…',
      '[init] drone tiles=4  lidar=urban_block_scan.laz  gis=building_footprints.geojson',
    ],
  },
  {
    at: 1,
    lines: [
      '',
      '[1/5] building extraction',
      '  > opencv: threshold + contour pass on orthomosaic',
      '  > candidates=128  filtered=82 footprints',
      '  > writing /tmp/extract/buildings.geojson',
    ],
  },
  {
    at: 2,
    lines: [
      '',
      '[2/5] floor segmentation',
      '  > height proxy from DEM/DSM + roof typology',
      '  > slicing vertical envelopes… floors≈380',
      '  > ok: midrise=8 skyscraper=6 lowrise=8',
    ],
  },
  {
    at: 3,
    lines: [
      '',
      '[3/5] vertical parcel delineation',
      '  > base–top elevation envelopes per apartment volume',
      '  > unit packs: sky=3 / mid=2 / low=1 houses per floor',
      '  > parcels ready=944 house units',
    ],
  },
  {
    at: 4,
    lines: [
      '',
      '[4/5] topology validation',
      '  > shapely: overlap / containment checks',
      '  > overlaps=0  containment_ok=true  gaps=0',
      '  > gate: PASSED',
    ],
  },
  {
    at: 5,
    lines: [
      '',
      '[5/5] 3D ULPIN generation',
      '  > pattern 3D-IND-<pin>-<body>-L<floor>-U<unit>',
      '  > composed 944 unit identities · registry freeze',
      '[done] pipeline complete — ready for footprint review',
    ],
  },
]

export function ProcessingPage() {
  const [tick, setTick] = useState(0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>(TERMINAL_SCRIPT[0].lines)
  const termRef = useRef<HTMLPreElement | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t >= 5) {
          window.clearInterval(id)
          return 5
        }
        return t + 1
      })
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const chunk = TERMINAL_SCRIPT.find((s) => s.at === tick)
    if (!chunk) return
    setLogs((prev) => {
      if (tick === 0) return chunk.lines
      return [...prev, ...chunk.lines]
    })
  }, [tick])

  useEffect(() => {
    const el = termRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  const complete = tick >= 5
  const polygonFile = 'verified_city_block_polygons.geojson'

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">AI pipeline</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Automated building extraction, floor segmentation, vertical parcel delineation, and
          topology checks culminating in standardized 3D ULPIN issuance.
        </p>
      </div>

      <PipelineStrip active={tick} />

      <div
        className={`rounded-2xl border px-5 py-4 ${
          complete ? 'border-ok/25 bg-ok/5' : 'border-line bg-white'
        }`}
      >
        <div className={`text-[14px] font-semibold ${complete ? 'text-ok' : 'text-ink'}`}>
          {complete ? 'AI processing complete' : `Processing survey package… step ${Math.min(tick + 1, 5)}/5`}
        </div>
        <div className="mt-1 text-[12px] leading-relaxed text-mute">
          {complete
            ? 'Extracted geometry is ready for footprint review and registry floors & units.'
            : 'The staged survey package is moving through extraction, segmentation, parcel delineation, validation, and ULPIN preparation.'}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-[#0B1210] shadow-inner">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Pipeline terminal</div>
          <div className="font-mono text-[10px] text-signal/80">
            {complete ? 'exit 0' : 'running…'}
          </div>
        </div>
        <pre
          ref={termRef}
          className="font-mono max-h-[280px] overflow-y-auto px-4 py-3 text-[12px] leading-relaxed text-[#9AE6B4]"
        >
          {logs.map((line, i) => (
            <div key={`${i}-${line.slice(0, 24)}`} className={line.startsWith('$') ? 'text-white/80' : undefined}>
              {line || '\u00a0'}
            </div>
          ))}
          {!complete && <span className="inline-block animate-pulse text-signal">█</span>}
        </pre>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['OpenCV footprint pass', 'Raster → building outlines for staged imagery'],
          ['Shapely topology', 'Overlap / containment checks across floors & units'],
          ['Vertical parcel model', 'Base–top elevation envelopes per apartment volume'],
          ['ULPIN composer', 'Namespace + building + floor + unit identity string'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-line bg-white px-5 py-4">
            <div className="text-[14px] font-semibold text-ink">{title}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-mute">{body}</div>
          </div>
        ))}
      </div>

      {complete && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Verified 2D polygon handoff</div>
                <div className="mt-1 text-[18px] font-semibold text-ink">AI-parsed building footprints</div>
                <div className="font-mono mt-1 text-[11px] text-signal">{polygonFile}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReviewOpen((v) => !v)}
                  className="rounded-xl bg-signal px-4 py-2.5 text-[13px] font-semibold text-white"
                >
                  {reviewOpen ? 'Hide polygons' : 'Review polygons'}
                </button>
                <Link
                  to="/app/polygon-labels"
                  className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
                >
                  Open 2D labels
                </Link>
              </div>
            </div>

            {reviewOpen && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="relative h-[420px] overflow-hidden rounded-2xl border border-line bg-ink">
                  <img
                    src={verifiedMarkedPolygons}
                    alt="Verified manually marked 2D building polygons"
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute left-4 top-4 rounded-full bg-ink/80 px-3 py-1 text-[11px] font-semibold text-white">
                    Verified 2D footprints
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-paper p-4">
                  <div className="text-[13px] font-semibold text-ink">Parsing result</div>
                  <div className="mt-3 space-y-3 text-[12px] text-mute">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="font-semibold text-ink">100</span> floor plans indexed
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="font-semibold text-ink">82</span> verified footprint polygons
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="font-semibold text-ink">6</span> source groups linked
                    </div>
                    <div className="rounded-xl border border-ok/20 bg-ok/5 px-3 py-2 text-ok">
                      Ready for registry / 3D Atlas
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/app/registry?tab=floors"
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              Open floors & units
            </Link>
            <a
              href="/extract/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              Review extracted footprints
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
