import { NextRequest, NextResponse } from "next/server"

const DEPTH_SERVER = "http://localhost:8100"

export async function POST(req: NextRequest) {
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
