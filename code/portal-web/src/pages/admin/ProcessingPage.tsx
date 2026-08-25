import { useEffect, useState } from 'react'
import { PipelineStrip } from '../../components/PipelineStrip'

export function ProcessingPage() {
  const [tick, setTick] = useState(2)

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => (t >= 4 ? 2 : t + 1))
    }, 2800)
    return () => clearInterval(id)
  }, [])

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
    </div>
  )
}
