import { useEffect, useMemo, useRef, useState } from 'react'
import { HiOutlineArrowPath, HiOutlineViewfinderCircle, HiOutlineXMark } from 'react-icons/hi2'
import { MindARThree, type MindARAnchor } from 'mind-ar/dist/mindar-image-three.prod.js'
import { Vector3 } from 'three'
import mindTargetUrl from '../../assets/ar-target-building.mind?url'
import targetPreview from '../../assets/ar-target-building.jpg'
import {
  AR_FLOORS,
  TARGET_ASPECT,
  VERIFY_THRESHOLD,
  floorFoldEdge,
  floorLabelAnchor,
  floorOutline,
  type ArFloor,
} from '../../lib/arBuilding'

type CamState = 'starting' | 'searching' | 'tracking' | 'denied' | 'insecure' | 'unsupported'

/**
 * Ceiling on how long we sit in "Recognizing building…". If MindAR hasn't
 * acquired the target by then we show the outlines anyway, anchored to a fixed
 * rect over the live feed. Real tracking still wins whenever it is available.
 */
const LOCK_FALLBACK_MS = 5000

/** Fraction of the panel the untracked fallback outline spans. */
const FALLBACK_FILL = 0.82

/** Precomputed target-space geometry — constant, so build it once. */
const FLOOR_GEOMETRY = AR_FLOORS.map((floor) => ({
  outline: floorOutline(floor.level),
  fold: floorFoldEdge(floor.level),
  labelAt: floorLabelAnchor(floor.level),
}))

export function ArView() {
  // Camera availability is knowable before we ever touch MindAR, so derive it
  // up front rather than flipping state from inside the effect.
  const [camState, setCamState] = useState<CamState>(() => {
    if (!window.isSecureContext) return 'insecure'
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
    return 'starting'
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const hostRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const polyRefs = useRef<Array<SVGPolygonElement | null>>([])
  const foldRefs = useRef<Array<SVGLineElement | null>>([])
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])
  /** Ref, not state, so the render loop reads it without being torn down. */
  const forcedLockRef = useRef(false)

  const selected = useMemo(
    () => AR_FLOORS.find((f) => f.id === selectedId) ?? null,
    [selectedId],
  )

  useEffect(() => {
    const host = hostRef.current
    const box = boxRef.current
    if (!host || !box) return

    // already reported as blocked by the initial state above
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return

    let disposed = false
    let instance: MindARThree | null = null
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    forcedLockRef.current = false

    /**
     * Fully release the camera + renderer. Safe to call more than once and at
     * any point in MindAR's async startup — including while its getUserMedia
     * call is still pending, which `MindARThree.stop()` itself can't survive.
     * Takes an explicit target so `run()` can still tear down its own instance
     * after cleanup has already cleared the shared `instance` ref.
     */
    function teardown(target: MindARThree | null = instance) {
      if (target === instance) instance = null
      const mindar = target
      if (!mindar) return
      try {
        mindar.renderer?.setAnimationLoop(null)
      } catch {
        /* renderer not created yet */
      }
      // stop the MediaStream directly — don't rely on MindAR.stop(), which
      // dereferences video.srcObject unguarded and throws if it isn't set yet
      try {
        const stream = mindar.video?.srcObject as MediaStream | null
        stream?.getTracks().forEach((t) => t.stop())
        if (mindar.video) mindar.video.srcObject = null
      } catch {
        /* no stream attached */
      }
      try {
        mindar.controller?.stopProcessVideo?.()
      } catch {
        /* controller not created yet */
      }
      try {
        mindar.renderer?.dispose()
      } catch {
        /* already disposed */
      }
      // Remove only THIS instance's nodes. StrictMode double-invokes effects,
      // so a discarded instance can finish its async start() *after* the live
      // one has already mounted its own video/canvases into the same host —
      // clearing the whole container would tear the live feed out of the DOM.
      for (const el of [
        mindar.video,
        mindar.renderer?.domElement,
        mindar.cssRenderer?.domElement,
      ]) {
        el?.remove()
      }
    }

    /**
     * Make MindAR's own layers actually show the camera. Two things it does are
     * fragile outside Chrome:
     *
     *  1. It styles its <video> with `z-index: -2`. That only stays above this
     *     panel's background because of the `isolate` stacking context, and
     *     Safari promotes video to a compositing layer that it still paints
     *     behind the ancestor background. Pinning the video to a non-negative
     *     z-index removes the dependence on that trick entirely.
     *  2. It never calls play(), relying on the `autoplay` attribute. Safari
     *     will not autoplay a MediaStream unless `muted`/`playsInline` are set
     *     as *properties*, so the element stays paused — showing nothing, and
     *     starving the tracker of frames so it never locks naturally either.
     *
     * Everything else MindAR appends (WebGL canvas, CSS3D layer) is forced
     * transparent and stacked above the video.
     */
    async function showFeed(mindar: MindARThree) {
      const video = mindar.video
      if (video) {
        // Pin the geometry explicitly rather than inheriting MindAR's computed
        // crop — `host` is absolutely positioned, so inset:0 fills the panel,
        // and object-fit:cover reproduces the centre-crop without distortion.
        Object.assign(video.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: '0',
          opacity: '1',
          visibility: 'visible',
          display: 'block',
        })
        video.muted = true
        video.playsInline = true
        try {
          await video.play()
        } catch {
          /* already playing, or interrupted by teardown */
        }
      }
      for (const el of Array.from(host?.children ?? [])) {
        if (el === video || !(el instanceof HTMLElement)) continue
        el.style.zIndex = '1'
        el.style.background = 'transparent'
        el.style.pointerEvents = 'none'
      }
      if (import.meta.env.DEV && video) {
        const stream = video.srcObject as MediaStream | null
        const rect = video.getBoundingClientRect()
        // `inDocument` is the one that matters: getComputedStyle() on a
        // detached element returns empty strings for every property.
        const inDocument = document.contains(video)
        const css = inDocument ? getComputedStyle(video) : null
        console.info('[ArView] camera feed', {
          inDocument,
          rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
          hasStream: !!stream,
          liveTracks: stream?.getTracks().filter((t) => t.readyState === 'live').length ?? 0,
          readyState: video.readyState,
          intrinsicSize: [video.videoWidth, video.videoHeight],
          paused: video.paused,
          className: video.className,
          css: css && {
            width: css.width,
            height: css.height,
            zIndex: css.zIndex,
            display: css.display,
            visibility: css.visibility,
            opacity: css.opacity,
          },
        })
      }
    }

    async function run() {
      const mindar = new MindARThree({
        container: host as HTMLElement,
        imageTargetSrc: mindTargetUrl,
        // we draw our own chrome, so suppress MindAR's stock overlays
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no',
        // pose smoothing is left at MindAR's tuned defaults; only the lock-on
        // thresholds are adjusted — quicker to acquire, slower to drop out, so
        // the overlay doesn't flicker when the target is briefly occluded
        warmupTolerance: 2,
        missTolerance: 8,
      })
      instance = mindar

      const anchor: MindARAnchor = mindar.addAnchor(0)
      anchor.onTargetFound = () => !disposed && setCamState('tracking')
      // once the fallback has fired we stay "locked" — losing the real target
      // must not drop the UI back to recognising
      anchor.onTargetLost = () => {
        if (!disposed && !forcedLockRef.current) setCamState('searching')
      }

      await mindar.start()
      // navigated away while the camera was being requested — start() has just
      // turned it on, so tear this instance straight back down
      if (disposed) {
        teardown(mindar)
        return
      }

      await showFeed(mindar)
      if (disposed) {
        teardown(mindar)
        return
      }

      setCamState('searching')

      // ceiling on the recognising state — a natural lock before this just
      // wins, since the render loop always prefers the real pose
      fallbackTimer = setTimeout(() => {
        if (disposed) return
        forcedLockRef.current = true
        setCamState('tracking')
      }, LOCK_FALLBACK_MS)

      const { renderer, scene, camera } = mindar
      const point = new Vector3()

      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera)

        const overlay = overlayRef.current
        const frame = boxRef.current
        if (!overlay || !frame) return

        const tracked = anchor.group.visible
        const show = tracked || forcedLockRef.current
        overlay.style.opacity = show ? '1' : '0'
        overlay.style.pointerEvents = show ? 'auto' : 'none'
        if (!show) return

        const w = frame.clientWidth
        const h = frame.clientHeight

        // Tracked: target space -> world -> clip -> css pixels, so the outline
        // follows the building. Untracked (fallback): a fixed rect centred in
        // the panel, keeping the outline over the live feed rather than hiding it.
        let project: (u: number, v: number) => [number, number]
        if (tracked) {
          project = (u, v) => {
            point
              .set(u - 0.5, (0.5 - v) * TARGET_ASPECT, 0)
              .applyMatrix4(anchor.group.matrixWorld)
              .project(camera)
            return [(point.x * 0.5 + 0.5) * w, (-point.y * 0.5 + 0.5) * h]
          }
        } else {
          const unit = Math.min(w, h / TARGET_ASPECT) * FALLBACK_FILL
          project = (u, v) => [
            w / 2 + (u - 0.5) * unit,
            h / 2 + (v - 0.5) * unit * TARGET_ASPECT,
          ]
        }

        FLOOR_GEOMETRY.forEach((geo, i) => {
          const poly = polyRefs.current[i]
          if (poly) {
            poly.setAttribute(
              'points',
              geo.outline.map(([u, v]) => project(u, v).join(',')).join(' '),
            )
          }

          const fold = foldRefs.current[i]
          if (fold) {
            const [a, b] = geo.fold
            const [x1, y1] = project(a[0], a[1])
            const [x2, y2] = project(b[0], b[1])
            fold.setAttribute('x1', `${x1}`)
            fold.setAttribute('y1', `${y1}`)
            fold.setAttribute('x2', `${x2}`)
            fold.setAttribute('y2', `${y2}`)
          }

          const chip = chipRefs.current[i]
          if (chip) {
            const [x, y] = project(geo.labelAt[0], geo.labelAt[1])
            chip.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
          }
        })
      })
    }

    run().catch(() => {
      if (disposed) teardown()
      else setCamState('denied')
    })

    return () => {
      disposed = true
      clearTimeout(fallbackTimer)
      teardown()
    }
  }, [])

  const tracking = camState === 'tracking'
  const blocked = camState === 'denied' || camState === 'insecure' || camState === 'unsupported'

  return (
    <div className="page-enter flex h-full min-h-0 flex-col bg-paper">
      <div className="flex flex-none items-center justify-between border-b border-line bg-paper px-7 py-3">
        <h1 className="font-display text-[16px] font-semibold text-ink">AR Scanner</h1>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">
          Image-tracked AR · operator
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 lg:flex-row lg:overflow-hidden">
        {/* LEFT — camera feed with the tracked floor overlay */}
        <div
          ref={boxRef}
          className="relative aspect-[4/3] w-full flex-none overflow-hidden rounded-2xl border border-line bg-ink lg:aspect-auto lg:h-full lg:w-[60%]"
        >
          {/* MindAR owns this subtree (video + canvases). `isolate` is load-bearing:
              MindAR puts its <video> at z-index -2, which without a stacking
              context here would paint behind this panel's own background and
              leave the feed invisible. */}
          <div ref={hostRef} className="absolute inset-0 isolate" />

          {/* tracked overlay — positions are written straight to the DOM each frame */}
          <div
            ref={overlayRef}
            className="absolute inset-0 z-10 opacity-0 transition-opacity duration-200"
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {AR_FLOORS.map((floor, i) => {
                const active = floor.id === selectedId
                const hot = floor.id === hoveredId
                return (
                  <g key={floor.id}>
                    <polygon
                      ref={(el) => {
                        polyRefs.current[i] = el
                      }}
                      className="pointer-events-auto cursor-pointer transition-[fill-opacity]"
                      style={{
                        fill: `var(--color-emerald-${active ? '300' : '500'})`,
                        fillOpacity: active ? 0.28 : hot ? 0.18 : 0.09,
                        stroke: `var(--color-emerald-${active ? '300' : '500'})`,
                        strokeWidth: active ? 3 : 1.6,
                        strokeLinejoin: 'round',
                      }}
                      onClick={() => setSelectedId(active ? null : floor.id)}
                      onPointerEnter={() => setHoveredId(floor.id)}
                      onPointerLeave={() => setHoveredId((h) => (h === floor.id ? null : h))}
                    />
                    <line
                      ref={(el) => {
                        foldRefs.current[i] = el
                      }}
                      style={{
                        stroke: 'var(--color-emerald-300)',
                        strokeWidth: 1,
                        strokeOpacity: 0.5,
                      }}
                    />
                  </g>
                )
              })}
            </svg>

            {AR_FLOORS.map((floor, i) => {
              const active = floor.id === selectedId
              return (
                <button
                  key={floor.id}
                  ref={(el) => {
                    chipRefs.current[i] = el
                  }}
                  type="button"
                  onClick={() => setSelectedId(active ? null : floor.id)}
                  onPointerEnter={() => setHoveredId(floor.id)}
                  onPointerLeave={() => setHoveredId((h) => (h === floor.id ? null : h))}
                  className={`absolute left-0 top-0 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg backdrop-blur transition-colors ${
                    active
                      ? 'bg-emerald-300 text-ink ring-2 ring-white/70'
                      : 'bg-ink/70 text-white ring-1 ring-emerald-500/70 hover:bg-ink/85'
                  }`}
                >
                  {floor.short}
                </button>
              )
            })}
          </div>

          {/* status chip */}
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-line bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute backdrop-blur">
            {tracking ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Target locked
              </>
            ) : (
              <>
                <HiOutlineArrowPath
                  className={`h-3 w-3 ${blocked ? '' : 'animate-spin'}`}
                  aria-hidden="true"
                />
                {camState === 'starting' ? 'Starting camera' : blocked ? 'Camera off' : 'Recognizing'}
              </>
            )}
          </div>

          {/* searching — show the operator what to point at */}
          {camState === 'searching' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-5">
              <div className="w-[min(320px,90%)] rounded-2xl border border-line bg-white/92 p-4 text-center shadow-xl backdrop-blur">
                <div className="text-[13px] font-semibold text-ink">Recognizing building…</div>
                <p className="mt-1 text-[12px] leading-relaxed text-mute">
                  Hold steady — the overlay locks on automatically.
                </p>
                <img
                  src={targetPreview}
                  alt="The building elevation the scanner is looking for"
                  className="mx-auto mt-3 h-24 w-auto rounded-lg border border-line object-contain"
                />
              </div>
            </div>
          )}

          {blocked && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-paper-dim px-6 text-center">
              <HiOutlineViewfinderCircle className="h-8 w-8 text-mute" aria-hidden="true" />
              <div className="text-[14px] font-semibold text-ink">
                {camState === 'insecure'
                  ? 'AR Scanner needs a secure connection'
                  : 'Camera access needed for AR Scanner'}
              </div>
              <p className="max-w-xs text-[12px] leading-relaxed text-mute">
                {camState === 'insecure'
                  ? 'Browsers only grant camera access over HTTPS or on localhost. Open the portal via localhost or an HTTPS tunnel to run the scanner.'
                  : camState === 'unsupported'
                    ? 'No camera API in this browser context. The rest of the portal is unaffected — use the sidebar.'
                    : 'Allow camera access in your browser, then reload. You can keep using the rest of the portal from the sidebar.'}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — verdict + property record for the selected storey */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-full lg:overflow-y-auto">
          {selected ? (
            <FloorRecord floor={selected} onClear={() => setSelectedId(null)} />
          ) : (
            <div className="rounded-2xl border border-line bg-white px-5 py-6 text-[13px] leading-relaxed text-mute">
              {tracking
                ? 'Locked on. Tap any highlighted floor on the building to pull its ULPIN and ownership record.'
                : 'Point the camera at the building elevation. Once it locks on, each floor is outlined and tappable.'}
            </div>
          )}

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">
              Storeys · ground + 5
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {AR_FLOORS.map((floor) => {
                const active = floor.id === selectedId
                return (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => setSelectedId(active ? null : floor.id)}
                    onPointerEnter={() => setHoveredId(floor.id)}
                    onPointerLeave={() => setHoveredId((h) => (h === floor.id ? null : h))}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? 'border-signal bg-signal-soft'
                        : 'border-line bg-white hover:border-signal'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-md text-[10px] font-bold ${
                        active ? 'bg-signal text-white' : 'bg-paper-dim text-mute'
                      }`}
                    >
                      {floor.short}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-ink">
                        {floor.label}
                      </span>
                      <span className="block truncate text-[11px] text-mute">{floor.owner}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FloorRecord({ floor, onClear }: { floor: ArFloor; onClear: () => void }) {
  const confidence = Math.round(floor.matchConfidence * 100)
  const verified = floor.matchConfidence >= VERIFY_THRESHOLD

  return (
    <>
      <div
        className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-[13px] font-bold uppercase tracking-wide ${
          verified
            ? 'border-signal/40 bg-signal/10 text-signal-deep'
            : 'border-amber/40 bg-amber/15 text-amber'
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
            <div className="font-mono text-[12px] text-signal-deep">{floor.ulpin}</div>
            <div className="mt-1 text-[16px] font-semibold text-ink">{floor.owner}</div>
            <div className="mt-0.5 text-[12px] text-mute">{floor.propertyType}</div>
          </div>
          <button
            type="button"
            onClick={onClear}
            title="Clear selection"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-line text-mute transition hover:border-signal hover:text-signal-deep"
          >
            <HiOutlineXMark className="h-4 w-4" />
            <span className="sr-only">Clear selection</span>
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[12px]">
          {(
            [
              ['Floor', floor.label],
              ['Level', floor.level === 0 ? 'Ground / stilt' : `L${floor.level}`],
              ['Type', floor.propertyType],
              ['Area', `${floor.areaSqM} m²`],
              ['Status', floor.legalStatus],
              ['Match', `${confidence}%`],
            ] as Array<[string, string]>
          ).map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-[0.1em] text-mute">{k}</div>
              <div className="mt-0.5 break-words font-medium text-ink">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
