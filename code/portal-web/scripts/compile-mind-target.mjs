/**
 * Offline compiler for the AR Scanner's MindAR image target.
 *
 * Usage:  node scripts/compile-mind-target.mjs src/assets/ar-target-building.jpg
 *         (defaults to that path; writes <input>.mind alongside it)
 *
 * Why this exists instead of MindAR's stock `OfflineCompiler`:
 * that class pulls in `node-canvas`, whose native build needs a cairo/pango
 * toolchain and has no prebuild for modern Node. But `CompilerBase` only ever
 * uses the canvas to blit an image 1:1 and read the pixels back — so we decode
 * the JPEG ourselves (via macOS `sips` → BMP, no dependencies) and hand the
 * compiler a stub canvas that just returns those pixels. Same output, no
 * native module.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js'
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js'
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js'
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js'

/** Decode an uncompressed BMP (24/32bpp, BITMAPINFOHEADER) to RGBA. */
function decodeBmp(buf) {
  if (buf[0] !== 0x42 || buf[1] !== 0x4d) throw new Error('not a BMP')
  const pixelOffset = buf.readUInt32LE(10)
  const headerSize = buf.readUInt32LE(14)
  if (headerSize < 40) throw new Error(`unsupported BMP header size ${headerSize}`)

  const width = buf.readInt32LE(18)
  const rawHeight = buf.readInt32LE(22)
  const height = Math.abs(rawHeight)
  const topDown = rawHeight < 0
  const bpp = buf.readUInt16LE(28)
  const compression = buf.readUInt32LE(30)

  if (bpp !== 24 && bpp !== 32) throw new Error(`unsupported BMP depth ${bpp}`)
  // 0 = BI_RGB, 3 = BI_BITFIELDS (still packed BGRA for sips output)
  if (compression !== 0 && compression !== 3) {
    throw new Error(`unsupported BMP compression ${compression}`)
  }

  const bytesPerPx = bpp / 8
  const rowSize = Math.floor((bpp * width + 31) / 32) * 4 // rows are 4-byte aligned
  const out = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y // BMP is bottom-up unless height is negative
    let src = pixelOffset + srcY * rowSize
    let dst = y * width * 4
    for (let x = 0; x < width; x++) {
      out[dst] = buf[src + 2] // B,G,R[,A] on disk
      out[dst + 1] = buf[src + 1]
      out[dst + 2] = buf[src]
      out[dst + 3] = bpp === 32 ? buf[src + 3] : 255
      src += bytesPerPx
      dst += 4
    }
  }
  return { width, height, data: out }
}

/** Decode any sips-readable image to RGBA, with no native deps. */
function decodeImage(path) {
  const dir = mkdtempSync(join(tmpdir(), 'mind-target-'))
  try {
    const bmpPath = join(dir, 'target.bmp')
    execFileSync('sips', ['-s', 'format', 'bmp', path, '--out', bmpPath], { stdio: 'ignore' })
    const decoded = decodeBmp(readFileSync(bmpPath))
    // 32bpp BMPs from sips can carry a zeroed alpha channel; the compiler only
    // reads RGB, but flatten anyway so the data is well-formed.
    for (let i = 3; i < decoded.data.length; i += 4) decoded.data[i] = 255
    return decoded
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Stands in for an HTMLCanvasElement. `CompilerBase` only calls
 * drawImage(img, 0, 0, w, h) followed by getImageData(0, 0, w, h) at the
 * image's own size, so the blit is an identity op and we can serve the
 * already-decoded pixels straight back.
 */
function stubCanvas(rgba) {
  const context = {
    drawImage() {},
    getImageData: () => ({ data: rgba.data, width: rgba.width, height: rgba.height }),
  }
  return { width: rgba.width, height: rgba.height, getContext: () => context }
}

class NodeCompiler extends CompilerBase {
  constructor(rgba) {
    super()
    this.rgba = rgba
  }

  createProcessCanvas() {
    return stubCanvas(this.rgba)
  }

  // Mirrors MindAR's OfflineCompiler: tracking features are extracted
  // synchronously on the CPU rather than in a worker.
  compileTrack({ progressCallback, targetImages, basePercent }) {
    const percentPerImage = (100 - basePercent) / targetImages.length
    const list = []
    let percent = 0
    for (const targetImage of targetImages) {
      const imageList = buildTrackingImageList(targetImage)
      const percentPerAction = percentPerImage / imageList.length
      list.push(
        extractTrackingFeatures(imageList, () => {
          percent += percentPerAction
          progressCallback(basePercent + percent)
        }),
      )
    }
    return Promise.resolve(list)
  }
}

const input = resolve(process.argv[2] ?? 'src/assets/ar-target-building.jpg')
const output = input.replace(/\.[^.]+$/, '.mind')

const rgba = decodeImage(input)
console.log(`compiling ${basename(input)} — ${rgba.width}x${rgba.height}`)

const compiler = new NodeCompiler(rgba)
let lastLogged = -10
await compiler.compileImageTargets([{ width: rgba.width, height: rgba.height }], (p) => {
  if (p - lastLogged >= 10) {
    lastLogged = p
    console.log(`  ${Math.round(p)}%`)
  }
})

const buffer = compiler.exportData()
writeFileSync(output, Buffer.from(buffer))
console.log(`wrote ${basename(output)} — ${(buffer.byteLength / 1024).toFixed(1)} KB`)
