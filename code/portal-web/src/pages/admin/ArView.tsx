import { useEffect, useRef, useState } from 'react'
import { HiOutlineArrowPath, HiOutlineViewfinderCircle } from 'react-icons/hi2'
import { api, type ArScan } from '../../lib/api'

type State =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'result'; scan: ArScan }
  | { phase: 'error'; message: string }

type CamState = 'requesting' | 'live' | 'denied' | 'unsupported'

const ANALYSIS_STEPS = [
  'Detecting building outline…',
  'Matching to registry…',
  'Retrieving ownership record…',
  'Aligning ULPIN overlay…',
]
const SCAN_MS = 5000
const VERIFY_THRESHOLD = 0.8

const SCANNER_CSS = `
@keyframes ar-idle-sweep { 0%,100% { top: 4%; opacity: .5 } 50% { top: 96%; opacity: .95 } }
@keyframes ar-fast-sweep { 0% { top: -2%; opacity: .12 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { top: 102%; opacity: .12 } }
@keyframes ar-bracket-flash { 0% { opacity: 1; transform: scale(1.015) } 100% { opacity: .75; transform: scale(1) } }
@keyframes ar-trigger-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(12,143,124,.5) } 60% { box-shadow: 0 0 0 12px rgba(12,143,124,0) } }
`

/** Detection box geometry (0-100 SVG units) from the scan's `corners_m` footprint. */
function boxFrom(corners: Array<[number, number, number]>) {
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const w = Math.max(...xs) - Math.min(...xs) || 1
  const d = Math.max(...ys) - Math.min(...ys) || 1
  const h = 42
  const bw = Math.max(24, Math.min(64, h * (w / d)))
  return { x0: 50 - bw / 2, x1: 50 + bw / 2, y0: 45 - h / 2, y1: 45 + h / 2 }
}

/** Laptops usually have a front cam only; phones/tablets get the rear cam. */
function preferredFacingMode(): 'environment' | 'user' {
  const ua = navigator.userAgent || ''
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|IEMobile|BlackBerry|Windows Phone/i.test(ua)
  const coarseSmall =
    !!window.matchMedia?.('(pointer: coarse)').matches &&
    Math.min(window.screen?.width || 9999, window.screen?.height || 9999) <= 900
  return mobileUA || coarseSmall ? 'environment' : 'user'
}

function ViewfinderBrackets({ flashing, flashKey }: { flashing: boolean; flashKey: number }) {
  const arm =
    'pointer-events-none absolute h-8 w-8 border-signal [filter:drop-shadow(0_1px_2px_rgba(11,18,16,0.5))]'
  return (
    <div
      key={flashing ? `f${flashKey}` : 'idle'}
      className={`pointer-events-none absolute inset-4 z-[6] ${flashing ? '' : 'opacity-80'}`}
      style={flashing ? { animation: 'ar-bracket-flash 0.5s ease-out forwards' } : undefined}
    >
      <div className={`${arm} left-0 top-0 rounded-tl-sm border-l-[2.5px] border-t-[2.5px]`} />
      <div className={`${arm} right-0 top-0 rounded-tr-sm border-r-[2.5px] border-t-[2.5px]`} />
      <div className={`${arm} right-0 bottom-0 rounded-br-sm border-r-[2.5px] border-b-[2.5px]`} />
      <div className={`${arm} left-0 bottom-0 rounded-bl-sm border-l-[2.5px] border-b-[2.5px]`} />
    </div>
  )
}

export function ArView() {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [step, setStep] = useState(0)
  const [fill, setFill] = useState(0)
  const [camState, setCamState] = useState<CamState>('requesting')
  const [captured, setCaptured] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  /** Snapshot the current video frame to a data URL (null if the frame isn't ready). */
  function captureStill(): string | null {
    const v = videoRef.current
    if (!v || !v.videoWidth || !v.videoHeight) return null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = v.videoWidth
      canvas.height = v.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.9)
    } catch {
      return null
    }
  }

  /** Discard the frozen still and resume the live feed at the idle state. */
  function scanAgain() {
    setCaptured(null)
    setState({ phase: 'idle' })
    void startCamera()
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState('unsupported')
      return
    }
    setCamState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: preferredFacingMode() } },
        audio: false,
      })
      stopCamera()
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        void videoRef.current.play().catch(() => {})
      }
      setCamState('live')
    } catch {
      setCamState('denied')
    }
  }

  // open the device camera on mount; release it on unmount
  useEffect(() => {
    void startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 5s staged "analysis" while scanning, then the real /ar/scan call
  useEffect(() => {
    if (state.phase !== 'scanning') return
    let cancelled = false
    const raf = requestAnimationFrame(() => setFill(100))
    const tick = setInterval(
      () => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)),
      SCAN_MS / ANALYSIS_STEPS.length,
    )
    const done = setTimeout(async () => {
      try {
        const scan = await api.arScan()
        if (cancelled) return
        // freeze the frame at the moment of detection, then power the camera off
        const still = captureStill()
        stopCamera()
        setCaptured(still)
        setState({ phase: 'result', scan })
      } catch (e) {
        if (!cancelled) setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    }, SCAN_MS)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearInterval(tick)
      clearTimeout(done)
    }
  }, [state.phase])

  const result = state.phase === 'result' ? state.scan : null
  const isResult = state.phase === 'result'
  const box = result ? boxFrom(result.overlay.corners_m) : null
  const confidence = result ? Math.round(result.match_confidence * 100) : 0
  const verified = result ? result.match_confidence >= VERIFY_THRESHOLD : false
  const scanning = state.phase === 'scanning'
  const chromeVisible = camState === 'live' && (state.phase === 'idle' || scanning)

  return (
    <div className="page-enter flex h-full min-h-0 flex-col bg-paper">
      <style>{SCANNER_CSS}</style>

      <div className="flex flex-none items-center justify-between border-b border-line bg-paper px-7 py-3">
        <h1 className="font-display text-[16px] font-semibold text-ink">AR Scanner</h1>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">
          Simulated AR · operator
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 lg:flex-row lg:overflow-hidden">
        {/* LEFT — live camera + detection chrome (self-contained) */}
        <div className="relative aspect-[4/3] w-full flex-none overflow-hidden rounded-2xl border border-line bg-paper-dim lg:aspect-auto lg:h-full lg:w-[60%]">
          {/* live feed — kept mounted (so `videoRef` survives a Scan-again), hidden once frozen */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${
              camState === 'live' && !isResult ? '' : 'opacity-0'
            }`}
          />
          {/* frozen capture — cropped to sit exactly inside the detection frame,
              with a neutral dark backdrop everywhere outside it */}
          {isResult && (
            <div className="absolute inset-0 bg-ink">
              {captured && box && (
                <img
                  src={captured}
                  alt="Captured region"
                  className="absolute object-cover"
                  style={{
                    left: `${box.x0}%`,
                    top: `${box.y0}%`,
                    width: `${box.x1 - box.x0}%`,
                    height: `${box.y1 - box.y0}%`,
                  }}
                />
              )}
            </div>
          )}
          {camState === 'live' && !isResult && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ boxShadow: 'inset 0 0 90px 8px rgba(11,18,16,0.30)' }}
            />
          )}

          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-line bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute backdrop-blur">
            Simulated AR
          </div>

          {chromeVisible && <ViewfinderBrackets flashing={scanning} flashKey={step} />}
          {chromeVisible && (
            <div className="pointer-events-none absolute inset-6 z-[5]">
              <div
                className="absolute left-0 right-0 h-[2px] bg-signal"
                style={{
                  boxShadow: '0 0 12px 1px rgba(12,143,124,0.7)',
                  animation: scanning
                    ? 'ar-fast-sweep 1.05s linear infinite'
                    : 'ar-idle-sweep 3.8s ease-in-out infinite',
                }}
              />
            </div>
          )}

          {/* detection box on the frozen capture */}
          {box && result && (
            <>
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full [filter:drop-shadow(0_1px_2px_rgba(11,18,16,0.55))]"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polygon
                  points={`${box.x0},${box.y0} ${box.x1},${box.y0} ${box.x1},${box.y1} ${box.x0},${box.y1}`}
                  fill="rgba(12,143,124,0.12)"
                  stroke="#0c8f7c"
                  strokeWidth={0.6}
                />
                {(
                  [
                    [box.x0, box.y0, 1, 1],
                    [box.x1, box.y0, -1, 1],
                    [box.x1, box.y1, -1, -1],
                    [box.x0, box.y1, 1, -1],
                  ] as Array<[number, number, number, number]>
                ).map(([x, y, sx, sy], i) => (
                  <path
                    key={i}
                    d={`M ${x} ${y + 5 * sy} L ${x} ${y} L ${x + 5 * sx} ${y}`}
                    fill="none"
                    stroke="#0c8f7c"
                    strokeWidth={1}
                  />
                ))}
              </svg>
              <div
                className="pointer-events-none absolute z-10 -translate-y-full rounded-md bg-signal px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg"
                style={{ left: `${box.x0}%`, top: `${box.y0}%` }}
              >
                {result.overlay.label}
              </div>
            </>
          )}

          {/* scanning overlay */}
          {camState === 'live' && scanning && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
              <div className="w-[min(320px,90%)] rounded-2xl border border-line bg-white/92 p-5 text-center shadow-xl backdrop-blur">
                <HiOutlineArrowPath className="mx-auto h-7 w-7 animate-spin text-signal" />
                <div className="mt-3 text-[13px] font-semibold text-ink">Analyzing structure…</div>
                <div className="mt-1 h-4 text-[12px] text-mute">{ANALYSIS_STEPS[step]}</div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-paper-dim">
                  <div
                    className="h-full rounded-full bg-signal"
                    style={{ width: `${fill}%`, transition: `width ${SCAN_MS - 150}ms linear` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* idle: hint + Scan trigger overlaid on the feed */}
          {camState === 'live' && state.phase === 'idle' && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-5">
              <div className="rounded-full bg-white/85 px-3 py-1 text-[12px] text-ink backdrop-blur">
                Point the camera at a building
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep(0)
                  setFill(0)
                  setState({ phase: 'scanning' })
                }}
                style={{ animation: 'ar-trigger-pulse 2s ease-out infinite' }}
                className="inline-flex items-center gap-2 rounded-xl bg-signal px-6 py-3.5 text-[13px] font-semibold text-white ring-2 ring-white/70 transition hover:bg-signal-deep"
              >
                <HiOutlineViewfinderCircle className="h-[18px] w-[18px]" />
                Scan
              </button>
            </div>
          )}

          {/* camera permission states */}
          {camState === 'requesting' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-paper-dim text-center">
              <HiOutlineArrowPath className="h-6 w-6 animate-spin text-signal" />
              <div className="text-[13px] text-mute">Requesting camera…</div>
            </div>
          )}
          {(camState === 'denied' || camState === 'unsupported') && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-paper-dim px-6 text-center">
              <HiOutlineViewfinderCircle className="h-8 w-8 text-mute" />
              <div className="text-[14px] font-semibold text-ink">Camera access needed for AR Scanner</div>
              <p className="max-w-xs text-[12px] leading-relaxed text-mute">
                {camState === 'unsupported'
                  ? 'No camera API in this context (needs HTTPS or localhost). The rest of the portal is unaffected — use the sidebar.'
                  : 'Allow camera access in your browser, then retry. You can keep using the rest of the portal from the sidebar.'}
              </p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="rounded-xl border border-line bg-white px-4 py-2 text-[12px] font-semibold text-ink hover:border-signal"
              >
                Retry camera
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — verdict + property record (separate, never overlapping the feed) */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-full lg:overflow-y-auto">
          {!result && state.phase !== 'error' && (
            <div className="rounded-2xl border border-line bg-white px-5 py-6 text-[13px] leading-relaxed text-mute">
              {scanning
                ? 'Analyzing the structure in view — the property record will appear here.'
                : 'Point the camera at a building and tap Scan. The identified ULPIN, owner and full property record show here.'}
            </div>
          )}

          {state.phase === 'error' && (
            <div className="rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-[13px] text-danger">
              Scan failed — {state.message}. Is the API on :8000?
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setState({ phase: 'idle' })}
                  className="rounded-lg border border-danger/30 bg-white px-3 py-1.5 text-[12px] font-semibold text-danger"
                >
                  Back to scanner
                </button>
              </div>
            </div>
          )}

          {result && (
            <>
              <div
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-[13px] font-bold uppercase tracking-wide ${
                  verified ? 'border-ok/40 bg-ok/10 text-ok' : 'border-amber/40 bg-amber/15 text-amber'
                }`}
              >
                <span aria-hidden="true" className="text-[16px]">
                  {verified ? '✓' : '⚠'}
                </span>
                {verified ? 'Match verified' : 'Low confidence match'}
                <span className="ml-auto font-mono text-[12px] font-semibold normal-case tracking-normal">
                  {confidence}%
                </span>
              </div>

              <div className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] text-signal-deep">{result.ulpin}</div>
                    <div className="mt-1 text-[16px] font-semibold text-ink">{result.owner}</div>
                    <div className="mt-0.5 text-[12px] text-mute">{result.overlay.sub_label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-mute">Match</div>
                    <div className="font-display text-[24px] font-semibold text-ink">{confidence}%</div>
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-paper-dim">
                      <div className="h-full rounded-full bg-signal" style={{ width: `${confidence}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[12px]">
                  {(
                    [
                      ['Building', result.building.name],
                      ['Floor', `${result.floor_label}${result.unit ? ` · ${result.unit}` : ''}`],
                      ['Type', result.property_type ?? '—'],
                      ['Area', result.area_sq_m != null ? `${result.area_sq_m} m²` : '—'],
                      ['Status', result.legal_status ?? '—'],
                      [
                        'GPS',
                        result.gps.latitude != null
                          ? `${result.gps.latitude.toFixed(5)}, ${result.gps.longitude?.toFixed(5)}`
                          : '—',
                      ],
                      ['Scan ID', result.scan_id],
                      ['Time', new Date(result.scanned_at).toLocaleString()],
                    ] as Array<[string, string]>
                  ).map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-mute">{k}</div>
                      <div className="mt-0.5 break-words font-medium text-ink">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={scanAgain}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-signal px-6 py-3 text-[13px] font-semibold text-white transition hover:bg-signal-deep"
              >
                <HiOutlineViewfinderCircle className="h-[18px] w-[18px]" />
                Scan again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
