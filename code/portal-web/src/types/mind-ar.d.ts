/**
 * Minimal typings for the prebuilt MindAR image-tracking bundle.
 * The package ships no types; we only declare the surface ArView uses.
 */
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three'

  export interface MindARAnchor {
    group: Group
    targetIndex: number
    visible: boolean
    onTargetFound: (() => void) | null
    onTargetLost: (() => void) | null
    onTargetUpdate: (() => void) | null
  }

  export interface MindARThreeOptions {
    container: HTMLElement
    imageTargetSrc: string
    maxTrack?: number
    uiLoading?: 'yes' | 'no' | string
    uiScanning?: 'yes' | 'no' | string
    uiError?: 'yes' | 'no' | string
    /** One-euro filter cutoff — lower is smoother but laggier. */
    filterMinCF?: number | null
    /** One-euro filter speed coefficient. */
    filterBeta?: number | null
    /** Frames the target must be seen before it counts as found. */
    warmupTolerance?: number | null
    /** Frames the target may be missing before it counts as lost. */
    missTolerance?: number | null
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions)
    scene: Scene
    camera: PerspectiveCamera
    renderer: WebGLRenderer
    /** CSS3D layer, appended alongside the WebGL canvas in the constructor. */
    cssRenderer: { domElement: HTMLElement }
    /** Created synchronously at the start of `start()`; `srcObject` is set only
     *  once getUserMedia resolves. */
    video: HTMLVideoElement
    /** Only exists once `start()` has reached its `_startAR` phase. */
    controller?: { stopProcessVideo?: () => void }
    anchors: MindARAnchor[]
    /** When true, MindAR asks for the user-facing webcam (laptops / Chrome). */
    shouldFaceUser: boolean
    addAnchor(targetIndex: number): MindARAnchor
    start(): Promise<void>
    /** Assumes `video.srcObject` is set — throws if called mid-startup. */
    stop(): void
  }
}
