const STEPS = [
  'Building extraction',
  'Floor segmentation',
  'Vertical parcel delineation',
  'Topology validation',
  '3D ULPIN generation',
]

export function PipelineStrip({ active = 2 }: { active?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-mute">
        AI cadastral pipeline
      </div>
      <div className="flex flex-col gap-0 md:flex-row">
        {STEPS.map((label, i) => {
          const done = i < active
          const current = i === active
          return (
            <div
              key={label}
              className={`relative flex-1 border-line px-4 py-4 md:border-r md:last:border-r-0 ${
                current ? 'bg-signal-soft/60' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done
                      ? 'bg-signal text-white'
                      : current
                        ? 'bg-ink text-white'
                        : 'bg-paper-dim text-mute'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={`text-[12.5px] font-medium ${current ? 'text-ink' : 'text-mute'}`}>
                  {label}
                </span>
              </div>
              {current && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-paper-dim">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-signal" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
