import { NextRequest, NextResponse } from "next/server"

const DEPTH_SERVER = "http://localhost:8100"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const res = await fetch(`${DEPTH_SERVER}/vectorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: body.image }),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Vectorize server returned ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: "Vectorize server unavailable" },
      { status: 503 }
    )
  }
}
