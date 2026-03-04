import { NextRequest, NextResponse } from "next/server"

export async function POST(_req: NextRequest) {
  return NextResponse.json({ message: "Wrapping is handled client-side" })
}
