"use client"

import dynamic from "next/dynamic"

const CanvasWorkspace = dynamic(
  () =>
    import("@/components/canvas/canvas-workspace").then(
      (mod) => mod.CanvasWorkspace
    ),
  { ssr: false }
)

export default function Page() {
  return <CanvasWorkspace />
}
