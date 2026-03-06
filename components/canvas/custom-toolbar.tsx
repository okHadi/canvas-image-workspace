"use client"

import React from "react"

import { useCanvasEngine } from "@/lib/canvas-engine"
import { CANVAS_FRAME_TYPE, GENERATED_IMAGE_TYPE } from "@/lib/canvas-engine/types"
import { useAppStore } from "@/lib/store"
import {
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  Frame,
  Type,
  PanelRightOpen,
  PanelRightClose,
  ImagePlus,
  GitBranch,
} from "lucide-react"
import { useRef } from "react"

export function CustomToolbar() {
  const engine = useCanvasEngine()
  const { sidebarOpen, toggleSidebar, addGeneratedImage, showProvenanceLines, setShowProvenanceLines } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddImage = () => {
    fileInputRef.current?.click()
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const center = engine.getViewportScreenCenter()
      const point = engine.screenToPage(center)

      // Cap dimensions so the image fits nicely on canvas
      let w = img.naturalWidth
      let h = img.naturalHeight
      const MAX = 600
      if (w > MAX || h > MAX) {
        const scale = MAX / Math.max(w, h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string

        const shape = engine.createShape({
          type: GENERATED_IMAGE_TYPE,
          x: point.x - w / 2,
          y: point.y - h / 2,
          props: {
            w,
            h,
            imageUrl: dataUrl,
            prompt: file.name,
            style: "Realistic",
            model: "Standard",
            aspectRatio: w === h ? "1:1" : w > h ? "16:9" : "9:16",
            seed: 0,
            isLoading: false,
            sourceFormat: file.type === "image/svg+xml" ? "svg" : "raster",
          },
        })

        addGeneratedImage({
          id: shape.id,
          prompt: file.name,
          model: "Standard",
          style: "Realistic",
          aspectRatio: w === h ? "1:1" : w > h ? "16:9" : "9:16",
          imageUrl: dataUrl,
          seed: 0,
        })
      }
      reader.readAsDataURL(file)
    }
    img.src = url

    // Reset so the same file can be re-selected
    e.target.value = ""
  }

  const handleAddFrame = () => {
    const center = engine.getViewportScreenCenter()
    const point = engine.screenToPage(center)
    engine.createShape({
      type: CANVAS_FRAME_TYPE,
      x: point.x - 256,
      y: point.y - 256,
      props: {
        w: 512,
        h: 512,
        label: "Frame",
      },
    })
  }

  const handleAddText = () => {
    const center = engine.getViewportScreenCenter()
    const point = engine.screenToPage(center)
    engine.createShape({
      type: "text",
      x: point.x - 100,
      y: point.y - 20,
      props: {
        text: "Double click to edit",
        fontSize: 18,
        color: "#ffffff",
        w: 200,
        h: 40,
      },
    })
  }

  const currentTool = engine.getCurrentToolId()

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        gap: 2,
        background: "#1a1a2e",
        borderRadius: 12,
        padding: "6px 8px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        pointerEvents: "all",
      }}
    >
      <ToolbarButton
        icon={<MousePointer2 size={18} />}
        label="Select"
        active={currentTool === "select"}
        onClick={() => engine.setCurrentTool("select")}
      />
      <ToolbarButton
        icon={<Hand size={18} />}
        label="Pan"
        active={currentTool === "hand"}
        onClick={() => engine.setCurrentTool("hand")}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={<ZoomIn size={18} />}
        label="Zoom in"
        onClick={() => engine.zoomIn(engine.getViewportScreenCenter())}
      />
      <ToolbarButton
        icon={<ZoomOut size={18} />}
        label="Zoom out"
        onClick={() => engine.zoomOut(engine.getViewportScreenCenter())}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={<Frame size={18} />}
        label="Add Frame"
        onClick={handleAddFrame}
      />
      <ToolbarButton
        icon={<Type size={18} />}
        label="Add Text"
        onClick={handleAddText}
      />
      <ToolbarButton
        icon={<ImagePlus size={18} />}
        label="Add Image"
        onClick={handleAddImage}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        style={{ display: "none" }}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={<GitBranch size={18} />}
        label="Provenance Lines"
        active={showProvenanceLines}
        onClick={() => setShowProvenanceLines(!showProvenanceLines)}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={
          sidebarOpen ? (
            <PanelRightClose size={18} />
          ) : (
            <PanelRightOpen size={18} />
          )
        }
        label={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        active={sidebarOpen}
        onClick={toggleSidebar}
      />
    </div>
  )
}

function ToolbarButton({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        color: active ? "#a0a8ff" : "#9999aa",
        background: active ? "rgba(120, 130, 255, 0.15)" : "transparent",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.06)"
          e.currentTarget.style.color = "#ccccdd"
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = "#9999aa"
        }
      }}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  )
}

function ToolbarDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 24,
        background: "rgba(255,255,255,0.08)",
        margin: "0 4px",
      }}
    />
  )
}
