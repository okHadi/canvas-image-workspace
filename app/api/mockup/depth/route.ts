import { NextRequest, NextResponse } from "next/server"
import { deflateSync } from "zlib"

const DEPTH_SERVER = "http://localhost:8100"

/**
 * Generate a minimal grayscale PNG from raw pixel bytes.
 * Uses Node.js zlib for DEFLATE compression required by PNG.
 */
function createGrayscalePng(width: number, height: number, pixels: Uint8Array): Buffer {
  // Build raw image data with filter byte (0 = None) per row
  const rawData = Buffer.alloc(height * (1 + width))
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width)] = 0 // filter byte
    const row = pixels.subarray(y * width, y * width + width)
    rawData.set(row, y * (1 + width) + 1)
  }

  const compressed = deflateSync(rawData)

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 0  // color type: grayscale
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const ihdrChunk = makeChunk("IHDR", ihdr)

  // IDAT chunk
  const idatChunk = makeChunk("IDAT", compressed)

  // IEND chunk
  const iendChunk = makeChunk("IEND", Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

function makeChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, "ascii")
  const crcInput = Buffer.concat([typeBuffer, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function generateDemoDepthResponse() {
  const W = 256
  const H = 256
  const centerX = W / 2
  const centerY = H / 2
  const sigma = W / 3

  // Gaussian depth map (Float32Array): bright center, dark edges
  const depthFloat = new Float32Array(W * H)
  const depthPixels = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
      const idx = y * W + x
      depthFloat[idx] = value
      depthPixels[idx] = Math.round(value * 255)
    }
  }

  // All-white garment mask — treats entire image as garment
  const maskPixels = new Uint8Array(W * H).fill(255)
  const maskFloat = new Uint8Array(W * H).fill(255)

  const depthPng = createGrayscalePng(W, H, depthPixels)
  const maskPng = createGrayscalePng(W, H, maskPixels)

  const depthDataBase64 = Buffer.from(depthFloat.buffer).toString("base64")
  const maskDataBase64 = Buffer.from(maskFloat.buffer).toString("base64")

  return {
    depth_map_image: depthPng.toString("base64"),
    depth_data: depthDataBase64,
    width: W,
    height: H,
    garment_mask_image: maskPng.toString("base64"),
    garment_mask_data: maskDataBase64,
  }
}

export async function POST(req: NextRequest) {
  // Demo mode: return synthetic depth data without Python backend
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.json(generateDemoDepthResponse())
  }

  try {
    const body = await req.json()

    const res = await fetch(`${DEPTH_SERVER}/depth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: body.image }),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Depth server returned ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: "Depth server unavailable. Start it with: cd depthv2/Depth-Anything-V2 && ../depthv2/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8100" },
      { status: 503 }
    )
  }
}
