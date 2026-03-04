"use client"

import { CanvasEngineProvider, useCanvasEngine, GENERATED_IMAGE_TYPE } from "@/lib/canvas-engine"
import { useAppStore } from "@/lib/store"
import { CustomToolbar } from "./custom-toolbar"
import { PromptSidebar } from "./prompt-sidebar"
import { FloatingToolbar } from "./floating-toolbar"
import { MockupOverlay } from "./mockup-overlay"
import { KonvaCanvas } from "./konva-canvas"
import { useEffect } from "react"

function CanvasInitializer() {
  const engine = useCanvasEngine()
  const addImage = useAppStore((s) => s.addGeneratedImage)

  useEffect(() => {
    // Only initialize once (check if shapes already exist)
    if (engine.getAllShapes().length > 0) return

    const placeholders = [
      { x: -620, y: -300, w: 512, h: 512, seed: 10, prompt: "Mountain landscape at sunset", style: "Realistic" },
      { x: -60, y: -300, w: 512, h: 512, seed: 20, prompt: "Cyberpunk city streets", style: "Illustration" },
      { x: 500, y: -300, w: 512, h: 512, seed: 30, prompt: "Abstract fluid art", style: "Watercolor" },
      { x: -620, y: 260, w: 768, h: 432, seed: 40, prompt: "Serene Japanese garden", style: "Vector" },
      { x: 200, y: 260, w: 432, h: 768, seed: 50, prompt: "Futuristic robot portrait", style: "3D Render" },
      { x: 680, y: 260, w: 640, h: 480, seed: 60, prompt: "Cozy coffee shop interior", style: "Realistic" },
    ]

    const shapes = engine.createShapes(
      placeholders.map((p) => ({
        type: GENERATED_IMAGE_TYPE,
        x: p.x,
        y: p.y,
        props: {
          w: p.w,
          h: p.h,
          imageUrl: `https://picsum.photos/seed/${p.seed}/${p.w}/${p.h}`,
          prompt: p.prompt,
          style: p.style,
          model: "Standard",
          aspectRatio: p.w === p.h ? "1:1" : p.w > p.h ? "16:9" : "9:16",
          seed: p.seed,
          isLoading: false,
        },
      }))
    )

    for (const shape of shapes) {
      const p = placeholders.find((pl) => pl.x === shape.x && pl.y === shape.y)!
      addImage({
        id: shape.id,
        prompt: p.prompt,
        model: "Standard",
        style: p.style as any,
        aspectRatio: p.w === p.h ? "1:1" : p.w > p.h ? "16:9" : "9:16",
        imageUrl: `https://picsum.photos/seed/${p.seed}/${p.w}/${p.h}`,
        seed: p.seed,
      })
    }

    // Zoom to fit after a short delay to allow rendering
    setTimeout(() => engine.zoomToFit(), 100)
  }, [engine, addImage])

  return null
}

export function CanvasWorkspace() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#0d0d1a",
      }}
    >
      <CanvasEngineProvider>
        <CanvasInitializer />
        <div style={{ position: "absolute", inset: 0 }}>
          <KonvaCanvas />
        </div>
        <CustomToolbar />
        <PromptSidebar />
        <FloatingToolbar />
        <MockupOverlay />
      </CanvasEngineProvider>

      {/* Global CSS keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Custom scrollbar for sidebar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  )
}
