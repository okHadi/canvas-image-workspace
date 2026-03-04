/**
 * Client-side depth-based displacement warp for product mockup overlay.
 * Renders a design image warped onto a surface using depth gradient displacement.
 */

const GRID_SIZE = 30
const WARP_STRENGTH = 50
const KERNEL_RATIO = 0.03
const MAX_DISPLACE = 0.08

interface WarpParams {
  ctx: CanvasRenderingContext2D
  overlayImg: HTMLImageElement
  depthData: Float32Array
  depthWidth: number
  depthHeight: number
  canvasWidth: number
  canvasHeight: number
  overlayX: number // 0-1 normalized center
  overlayY: number // 0-1 normalized center
  overlayScale: number
  overlayOpacity: number
  garmentMask?: Uint8Array | null
  garmentMaskWidth?: number
  garmentMaskHeight?: number
}

function sampleDepth(depthData: Float32Array, dw: number, dh: number, x: number, y: number): number {
  const ix = Math.max(0, Math.min(dw - 1, Math.round(x)))
  const iy = Math.max(0, Math.min(dh - 1, Math.round(y)))
  return depthData[iy * dw + ix]
}

function getDepthGradient(
  depthData: Float32Array,
  dw: number,
  dh: number,
  x: number,
  y: number
): { gx: number; gy: number } {
  const kx = Math.max(2, Math.round(dw * KERNEL_RATIO))
  const ky = Math.max(2, Math.round(dh * KERNEL_RATIO))
  const left = sampleDepth(depthData, dw, dh, x - kx, y)
  const right = sampleDepth(depthData, dw, dh, x + kx, y)
  const up = sampleDepth(depthData, dw, dh, x, y - ky)
  const down = sampleDepth(depthData, dw, dh, x, y + ky)
  return { gx: right - left, gy: down - up }
}

/**
 * Draws a textured triangle using affine transformation and clipping.
 */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  // Source triangle (texture coordinates)
  sx0: number, sy0: number,
  sx1: number, sy1: number,
  sx2: number, sy2: number,
  // Destination triangle (canvas coordinates)
  dx0: number, dy0: number,
  dx1: number, dy1: number,
  dx2: number, dy2: number,
) {
  ctx.save()

  // Clip to destination triangle
  ctx.beginPath()
  ctx.moveTo(dx0, dy0)
  ctx.lineTo(dx1, dy1)
  ctx.lineTo(dx2, dy2)
  ctx.closePath()
  ctx.clip()

  // Solve affine transform: source → destination
  // We need M such that M * [sx, sy, 1]^T = [dx, dy]^T for each vertex
  const denom = (sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1))
  if (Math.abs(denom) < 1e-10) {
    ctx.restore()
    return
  }
  const inv = 1 / denom

  const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) * inv
  const b = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) * inv
  const c = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) * inv
  const d = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) * inv
  const e = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) * inv
  const f = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) * inv

  ctx.setTransform(a, d, b, e, c, f)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

/**
 * Applies depth-based shading to simulate surface curvature lighting.
 * Darker in valleys, lighter on ridges (light assumed from top-left).
 */
function applyDepthShading(
  ctx: CanvasRenderingContext2D,
  depthData: Float32Array,
  dw: number,
  dh: number,
  regionX: number,
  regionY: number,
  regionW: number,
  regionH: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const shadingCanvas = document.createElement("canvas")
  shadingCanvas.width = canvasWidth
  shadingCanvas.height = canvasHeight
  const sCtx = shadingCanvas.getContext("2d")!

  const cols = GRID_SIZE
  const rows = GRID_SIZE
  const cellW = regionW / cols
  const cellH = regionH / rows

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = regionX + (col + 0.5) * cellW
      const cy = regionY + (row + 0.5) * cellH

      const dx = (cx / canvasWidth) * dw
      const dy = (cy / canvasHeight) * dh
      const { gx, gy } = getDepthGradient(depthData, dw, dh, dx, dy)

      // Light from top-left: positive gradient = facing away from light
      const shade = (gx + gy) * 0.5

      const x = regionX + col * cellW
      const y = regionY + row * cellH

      if (shade > 0) {
        sCtx.fillStyle = `rgba(255,255,255,${Math.min(0.08, shade * 1.5)})`
      } else {
        sCtx.fillStyle = `rgba(0,0,0,${Math.min(0.1, -shade * 1.5)})`
      }
      sCtx.fillRect(x, y, cellW + 1, cellH + 1)
    }
  }

  // Apply shading only where the overlay has pixels
  ctx.save()
  ctx.globalCompositeOperation = "source-atop"
  ctx.drawImage(shadingCanvas, 0, 0)
  ctx.restore()
}

/**
 * Multiplies overlay alpha by the garment mask value, clipping the design
 * to garment-only pixels. Maps canvas coords to mask coords.
 */
function applyGarmentMask(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  maskW: number,
  maskH: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
  const pixels = imageData.data

  for (let y = 0; y < canvasHeight; y++) {
    // Map canvas Y to mask Y
    const my = Math.max(0, Math.min(maskH - 1, Math.round((y / canvasHeight) * maskH)))
    for (let x = 0; x < canvasWidth; x++) {
      const pidx = (y * canvasWidth + x) * 4
      const alpha = pixels[pidx + 3]
      if (alpha === 0) continue

      // Map canvas X to mask X
      const mx = Math.max(0, Math.min(maskW - 1, Math.round((x / canvasWidth) * maskW)))
      const maskVal = mask[my * maskW + mx] // 0-255

      // Multiply alpha by mask value (both 0-255 range)
      pixels[pidx + 3] = Math.round((alpha * maskVal) / 255)
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Renders the overlay image warped according to depth data.
 */
export function renderWarpedOverlay(params: WarpParams) {
  const {
    ctx, overlayImg, depthData, depthWidth, depthHeight,
    canvasWidth, canvasHeight, overlayX, overlayY, overlayScale, overlayOpacity,
    garmentMask, garmentMaskWidth, garmentMaskHeight,
  } = params

  const imgW = overlayImg.naturalWidth || overlayImg.width
  const imgH = overlayImg.naturalHeight || overlayImg.height
  if (imgW === 0 || imgH === 0) return

  // Overlay region in canvas space
  const regionW = canvasWidth * overlayScale
  const regionH = (imgH / imgW) * regionW
  const regionX = overlayX * canvasWidth - regionW / 2
  const regionY = overlayY * canvasHeight - regionH / 2

  // Render warped overlay to offscreen canvas for compositing
  const offscreen = document.createElement("canvas")
  offscreen.width = canvasWidth
  offscreen.height = canvasHeight
  const offCtx = offscreen.getContext("2d")!

  const cols = GRID_SIZE
  const rows = GRID_SIZE

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 4 corners of this grid cell
      const corners = [
        { gr: row, gc: col },
        { gr: row, gc: col + 1 },
        { gr: row + 1, gc: col + 1 },
        { gr: row + 1, gc: col },
      ]

      const dst = corners.map(({ gr, gc }) => {
        const u = gc / cols
        const v = gr / rows

        // Position in canvas space
        const cx = regionX + u * regionW
        const cy = regionY + v * regionH

        // Map to depth space
        const dx = (cx / canvasWidth) * depthWidth
        const dy = (cy / canvasHeight) * depthHeight

        // Get depth gradient for displacement
        const { gx, gy } = getDepthGradient(depthData, depthWidth, depthHeight, dx, dy)

        const maxDisplace = Math.max(regionW, regionH) * MAX_DISPLACE
        return {
          x: cx + Math.max(-maxDisplace, Math.min(maxDisplace, gx * WARP_STRENGTH)),
          y: cy + Math.max(-maxDisplace, Math.min(maxDisplace, gy * WARP_STRENGTH)),
        }
      })

      // Source coordinates in image pixel space
      const src = corners.map(({ gr, gc }) => ({
        x: (gc / cols) * imgW,
        y: (gr / rows) * imgH,
      }))

      // Triangle 1: top-left, top-right, bottom-right
      drawTexturedTriangle(
        offCtx, overlayImg,
        src[0].x, src[0].y, src[1].x, src[1].y, src[2].x, src[2].y,
        dst[0].x, dst[0].y, dst[1].x, dst[1].y, dst[2].x, dst[2].y,
      )

      // Triangle 2: top-left, bottom-right, bottom-left
      drawTexturedTriangle(
        offCtx, overlayImg,
        src[0].x, src[0].y, src[2].x, src[2].y, src[3].x, src[3].y,
        dst[0].x, dst[0].y, dst[2].x, dst[2].y, dst[3].x, dst[3].y,
      )
    }
  }

  // Apply depth-based shading to the offscreen overlay
  applyDepthShading(offCtx, depthData, depthWidth, depthHeight,
    regionX, regionY, regionW, regionH, canvasWidth, canvasHeight)

  // Apply garment mask to clip overlay to garment-only pixels
  if (garmentMask && garmentMaskWidth && garmentMaskHeight) {
    applyGarmentMask(offCtx, garmentMask, garmentMaskWidth, garmentMaskHeight, canvasWidth, canvasHeight)
  }

  // Composite onto main canvas:
  // 1) Source-over — vibrant, opaque design
  ctx.save()
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = overlayOpacity
  ctx.drawImage(offscreen, 0, 0)

  // 2) Subtle multiply — fabric texture integration
  ctx.globalCompositeOperation = "multiply"
  ctx.globalAlpha = overlayOpacity * 0.15
  ctx.drawImage(offscreen, 0, 0)
  ctx.restore()
}
