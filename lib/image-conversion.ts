import ImageTracer from "imagetracerjs"

const MAX_TRACE_SIZE = 1024

/**
 * Vectorize a raster image (PNG/JPG data URL or URL) into an SVG data URL.
 * Uses vtracer backend for high-quality output, falls back to imagetracerjs.
 */
export async function vectorizeImage(imageUrl: string): Promise<string> {
  // Load image and draw to canvas (handles CORS)
  const img = await loadImage(imageUrl)

  const scale = Math.min(1, MAX_TRACE_SIZE / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, w, h)

  // Try vtracer backend first
  try {
    const pngDataUrl = canvas.toDataURL("image/png")
    const base64 = pngDataUrl.split(",")[1]

    const res = await fetch("/api/vectorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
    })

    if (res.ok) {
      const data = await res.json()
      const encoded = btoa(unescape(encodeURIComponent(data.svg)))
      return `data:image/svg+xml;base64,${encoded}`
    }
  } catch {
    // Fall through to imagetracerjs
  }

  // Fallback: imagetracerjs with "detailed" preset (64 colors)
  const imageData = ctx.getImageData(0, 0, w, h)
  const svgString = ImageTracer.imagedataToSVG(imageData, "detailed")

  const encoded = btoa(unescape(encodeURIComponent(svgString)))
  return `data:image/svg+xml;base64,${encoded}`
}

/**
 * Rasterize an SVG data URL to a PNG data URL at the specified dimensions.
 */
export async function rasterizeImage(
  svgDataUrl: string,
  width: number,
  height: number
): Promise<string> {
  const img = await loadImage(svgDataUrl)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL("image/png")
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = src
  })
}
