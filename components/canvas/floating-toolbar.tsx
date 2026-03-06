"use client"

import React from "react"

import { useCanvasEngine, useCanvasValue } from "@/lib/canvas-engine"
import { GENERATED_IMAGE_TYPE, CANVAS_FRAME_TYPE } from "@/lib/canvas-engine/types"
import { useAppStore, mockDelay, getNextSeed, getPicsumUrl, getAspectDimensions } from "@/lib/store"
import type { AspectRatio } from "@/lib/store"
import {
  ImageMinus,
  Eraser,
  Paintbrush,
  Expand,
  ArrowUpFromLine,
  Copy,
  Trash2,
  Download,
  Shuffle,
  Send,
  Type,
  ImageIcon,
  Pencil,
  RectangleHorizontal,
  Square,
  RectangleVertical,
  CopyPlus,
  Blend,
  X,
  Box,
  Spline,
  Grid2X2,
} from "lucide-react"
import { useState, useCallback, useEffect, useRef } from "react"
import { vectorizeImage, rasterizeImage } from "@/lib/image-conversion"

export function FloatingToolbar() {
  const engine = useCanvasEngine()

  const selectedShapeIds = useCanvasValue("selected ids", (e) => e.getSelectedShapeIds(), [])
  const cameraZ = useCanvasValue("camera z", (e) => e.getCamera().z, [])

  if (selectedShapeIds.length === 0) return null

  if (selectedShapeIds.length >= 2) {
    return <MultiSelectToolbar selectedShapeIds={selectedShapeIds} />
  }

  const shapeId = selectedShapeIds[0]
  const shape = engine.getShape(shapeId)
  if (!shape) return null

  const bounds = engine.getShapePageBounds(shapeId)
  if (!bounds) return null

  const screenPoint = engine.pageToScreen({ x: bounds.x + bounds.w / 2, y: bounds.y })

  if (shape.type === GENERATED_IMAGE_TYPE) {
    return (
      <GeneratedImageToolbar
        shapeId={shapeId}
        x={screenPoint.x}
        y={screenPoint.y}
        shape={shape}
      />
    )
  }

  if (shape.type === CANVAS_FRAME_TYPE) {
    return (
      <FrameToolbar
        shapeId={shapeId}
        x={screenPoint.x}
        y={screenPoint.y}
        shape={shape}
      />
    )
  }

  return null
}

function MultiSelectToolbar({ selectedShapeIds }: { selectedShapeIds: string[] }) {
  const engine = useCanvasEngine()
  const { addProcessingShape, removeProcessingShape, addGeneratedImage } = useAppStore()
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [remixPrompt, setRemixPrompt] = useState("")

  // Compute union bounding box of all selected shapes
  const unionBounds = React.useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of selectedShapeIds) {
      const b = engine.getShapePageBounds(id)
      if (!b) continue
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.w)
      maxY = Math.max(maxY, b.y + b.h)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }, [selectedShapeIds, engine])

  const screenPoint = engine.pageToScreen({ x: unionBounds.x + unionBounds.w / 2, y: unionBounds.y })

  const handleRemix = useCallback(async () => {
    if (!remixPrompt.trim()) return
    const tempId = "remix-" + Math.random().toString(36).slice(2, 9)
    addProcessingShape(tempId)
    setShowPromptInput(false)

    await mockDelay(1500, 2500)

    const w = Math.round(Math.min(unionBounds.w, 768))
    const h = Math.round(Math.min(unionBounds.h, 768))
    const seed = getNextSeed()
    const imageUrl = getPicsumUrl(w || 512, h || 512, seed)

    const newShape = engine.createShape({
      type: GENERATED_IMAGE_TYPE,
      x: unionBounds.x + unionBounds.w + 40,
      y: unionBounds.y,
      props: {
        w: w || 512,
        h: h || 512,
        imageUrl,
        prompt: remixPrompt,
        style: "Realistic" as const,
        model: "Standard" as const,
        aspectRatio: "1:1" as const,
        seed,
        isLoading: false,
        sourceShapeIds: [...selectedShapeIds],
      },
    })

    addGeneratedImage({
      id: newShape.id,
      prompt: remixPrompt,
      model: "Standard",
      style: "Realistic",
      aspectRatio: "1:1",
      imageUrl,
      seed,
    })

    engine.selectShape(newShape.id)
    removeProcessingShape(tempId)
    setRemixPrompt("")
  }, [remixPrompt, selectedShapeIds, unionBounds, engine, addProcessingShape, removeProcessingShape, addGeneratedImage])

  const handleDeleteAll = useCallback(() => {
    for (const id of selectedShapeIds) {
      engine.deleteShape(id)
    }
  }, [selectedShapeIds, engine])

  return (
    <div
      style={{
        position: "fixed",
        left: screenPoint.x,
        top: screenPoint.y - 56,
        transform: "translateX(-50%)",
        zIndex: 400,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "all",
      }}
    >
      {showPromptInput && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a2e",
            borderRadius: 10,
            padding: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            gap: 6,
            width: 280,
          }}
        >
          <input
            type="text"
            value={remixPrompt}
            onChange={(e) => setRemixPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRemix()}
            placeholder="Describe your remix..."
            autoFocus
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 10px",
              color: "#e0e0f0",
              fontSize: 12,
              outline: "none",
              fontFamily: "system-ui, sans-serif",
            }}
          />
          <button
            onClick={handleRemix}
            style={{
              background: "rgba(120,130,255,0.2)",
              border: "none",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#a0a8ff",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <Send size={14} />
          </button>
          <button
            onClick={() => setShowPromptInput(false)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#666680",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "#1a1a2e",
          borderRadius: 10,
          padding: "4px 6px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "#a0a8ff",
            padding: "0 8px",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          {selectedShapeIds.length} selected
        </span>
        <FloatDivider />
        <FloatBtn
          icon={<Blend size={14} />}
          label="Remix"
          onClick={() => setShowPromptInput(!showPromptInput)}
          active={showPromptInput}
        />
        <FloatDivider />
        <FloatBtn icon={<Trash2 size={14} />} label="Delete All" onClick={handleDeleteAll} danger />
      </div>
    </div>
  )
}

function GeneratedImageToolbar({
  shapeId,
  x,
  y,
  shape,
}: {
  shapeId: string
  x: number
  y: number
  shape: any
}) {
  const engine = useCanvasEngine()
  const { processingShapes, addProcessingShape, removeProcessingShape, setMockupDepth, addGeneratedImage } = useAppStore()
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [editPrompt, setEditPrompt] = useState("")
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null)
  const isProcessing = processingShapes.has(shapeId)

  const handleAiTool = useCallback(
    async (toolName: string) => {
      addProcessingShape(shapeId)
      await mockDelay()
      const seed = getNextSeed()
      const w = shape.props.w
      const h = shape.props.h
      engine.updateShape({
        id: shapeId,
        type: GENERATED_IMAGE_TYPE,
        props: {
          imageUrl: getPicsumUrl(Math.round(w), Math.round(h), seed),
          seed,
        },
      })
      removeProcessingShape(shapeId)
    },
    [shapeId, shape, engine, addProcessingShape, removeProcessingShape]
  )

  const handleProductMockup = useCallback(async () => {
    addProcessingShape(shapeId)
    try {
      // Extract image as base64
      const imageUrl = shape.props.imageUrl
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          resolve(dataUrl.split(",")[1])
        }
        reader.readAsDataURL(blob)
      })

      // Call depth API
      const depthRes = await fetch("/api/mockup/depth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      })

      if (!depthRes.ok) {
        const err = await depthRes.json()
        alert(err.error || "Depth estimation failed")
        removeProcessingShape(shapeId)
        return
      }

      const data = await depthRes.json()

      // Decode Float32Array from base64
      const binaryStr = atob(data.depth_data)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const depthFloat32 = new Float32Array(bytes.buffer)

      const depthMapUrl = `data:image/png;base64,${data.depth_map_image}`

      // Decode garment mask if present
      let garmentMaskUrl: string | null = null
      let garmentMask: Uint8Array | null = null
      let garmentMaskWidth = 0
      let garmentMaskHeight = 0

      if (data.garment_mask_data && data.garment_mask_image) {
        garmentMaskUrl = `data:image/png;base64,${data.garment_mask_image}`
        const maskBinaryStr = atob(data.garment_mask_data)
        const maskBytes = new Uint8Array(maskBinaryStr.length)
        for (let i = 0; i < maskBinaryStr.length; i++) {
          maskBytes[i] = maskBinaryStr.charCodeAt(i)
        }
        garmentMask = maskBytes
        garmentMaskWidth = data.width
        garmentMaskHeight = data.height
      }

      setMockupDepth(shapeId, depthMapUrl, depthFloat32, data.width, data.height, garmentMaskUrl, garmentMask, garmentMaskWidth, garmentMaskHeight)
    } catch (e) {
      alert("Failed to connect to depth server. Make sure it is running on port 8100.")
    }
    removeProcessingShape(shapeId)
  }, [shapeId, shape, addProcessingShape, removeProcessingShape, setMockupDepth])

  const handleEditPrompt = useCallback(async () => {
    if (!editPrompt.trim()) return
    addProcessingShape(shapeId)
    setShowPromptInput(false)
    await mockDelay()
    const seed = getNextSeed()
    const w = shape.props.w
    const h = shape.props.h
    engine.updateShape({
      id: shapeId,
      type: GENERATED_IMAGE_TYPE,
      props: {
        imageUrl: getPicsumUrl(Math.round(w), Math.round(h), seed),
        seed,
        prompt: editPrompt,
      },
    })
    removeProcessingShape(shapeId)
    setEditPrompt("")
  }, [editPrompt, shapeId, shape, engine, addProcessingShape, removeProcessingShape])

  const handleVectorize = useCallback(async () => {
    addProcessingShape(shapeId)
    try {
      const svgDataUrl = await vectorizeImage(shape.props.imageUrl)
      const bounds = engine.getShapePageBounds(shapeId)
      if (!bounds) return
      const newShape = engine.createShape({
        type: GENERATED_IMAGE_TYPE,
        x: bounds.x + bounds.w + 30,
        y: bounds.y,
        props: {
          w: shape.props.w,
          h: shape.props.h,
          imageUrl: svgDataUrl,
          prompt: shape.props.prompt || "Vectorized",
          style: shape.props.style,
          model: shape.props.model,
          aspectRatio: shape.props.aspectRatio,
          seed: shape.props.seed,
          isLoading: false,
          sourceFormat: "svg" as const,
        },
      })
      addGeneratedImage({
        id: newShape.id,
        prompt: shape.props.prompt || "Vectorized",
        model: shape.props.model,
        style: shape.props.style,
        aspectRatio: shape.props.aspectRatio,
        imageUrl: svgDataUrl,
        seed: shape.props.seed,
      })
    } catch (e) {
      alert("Vectorization failed: " + (e as Error).message)
    }
    removeProcessingShape(shapeId)
  }, [shapeId, shape, engine, addProcessingShape, removeProcessingShape, addGeneratedImage])

  const handleRasterize = useCallback(async () => {
    addProcessingShape(shapeId)
    try {
      const pngDataUrl = await rasterizeImage(shape.props.imageUrl, Math.round(shape.props.w), Math.round(shape.props.h))
      const bounds = engine.getShapePageBounds(shapeId)
      if (!bounds) return
      const newShape = engine.createShape({
        type: GENERATED_IMAGE_TYPE,
        x: bounds.x + bounds.w + 30,
        y: bounds.y,
        props: {
          w: shape.props.w,
          h: shape.props.h,
          imageUrl: pngDataUrl,
          prompt: shape.props.prompt || "Rasterized",
          style: shape.props.style,
          model: shape.props.model,
          aspectRatio: shape.props.aspectRatio,
          seed: shape.props.seed,
          isLoading: false,
          sourceFormat: "raster" as const,
        },
      })
      addGeneratedImage({
        id: newShape.id,
        prompt: shape.props.prompt || "Rasterized",
        model: shape.props.model,
        style: shape.props.style,
        aspectRatio: shape.props.aspectRatio,
        imageUrl: pngDataUrl,
        seed: shape.props.seed,
      })
    } catch (e) {
      alert("Rasterization failed: " + (e as Error).message)
    }
    removeProcessingShape(shapeId)
  }, [shapeId, shape, engine, addProcessingShape, removeProcessingShape, addGeneratedImage])

  const handleExport = useCallback(() => {
    if (shape.props.sourceFormat === "svg") {
      // Decode base64 SVG and export as .svg file
      const dataUrl = shape.props.imageUrl as string
      const base64 = dataUrl.split(",")[1]
      const svgString = decodeURIComponent(escape(atob(base64)))
      const blob = new Blob([svgString], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `generated-${shapeId}.svg`
      link.click()
      URL.revokeObjectURL(url)
    } else {
      const link = document.createElement("a")
      link.href = shape.props.imageUrl
      link.download = `generated-${shapeId}.jpg`
      link.click()
    }
  }, [shape, shapeId])

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(shape.props.prompt || "")
  }, [shape])

  const handleVariations = useCallback(async () => {
    addProcessingShape(shapeId)
    const w = shape.props.w
    const h = shape.props.h
    const bounds = engine.getShapePageBounds(shapeId)
    if (!bounds) return

    await mockDelay()

    for (let i = 0; i < 3; i++) {
      const seed = getNextSeed()
      engine.createShape({
        type: GENERATED_IMAGE_TYPE,
        x: bounds.x + (i + 1) * (w + 20),
        y: bounds.y,
        props: {
          w,
          h,
          imageUrl: getPicsumUrl(Math.round(w), Math.round(h), seed),
          prompt: shape.props.prompt,
          style: shape.props.style,
          model: shape.props.model,
          aspectRatio: shape.props.aspectRatio,
          seed,
          isLoading: false,
        },
      })
    }
    removeProcessingShape(shapeId)
  }, [shapeId, shape, engine, addProcessingShape, removeProcessingShape])

  const handleDelete = useCallback(() => {
    engine.deleteShape(shapeId)
  }, [engine, shapeId])

  const handleAddText = useCallback(() => {
    const bounds = engine.getShapePageBounds(shapeId)
    if (!bounds) return
    engine.createShape({
      type: "text",
      x: bounds.x + 20,
      y: bounds.y + bounds.h / 2,
      props: {
        text: "Text",
        fontSize: 18,
        color: "#ffffff",
        w: 200,
        h: 40,
      },
    })
    setActiveSubMenu(null)
  }, [engine, shapeId])

  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y - 56,
        transform: "translateX(-50%)",
        zIndex: 400,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "all",
      }}
    >
      {isProcessing && (
        <div
          style={{
            position: "absolute",
            top: -28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a2e",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 11,
            color: "#a0a8ff",
            whiteSpace: "nowrap",
            border: "1px solid rgba(120,130,255,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              border: "2px solid rgba(160,168,255,0.3)",
              borderTopColor: "#a0a8ff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Processing...
        </div>
      )}

      {showPromptInput && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a2e",
            borderRadius: 10,
            padding: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            gap: 6,
            width: 280,
          }}
        >
          <input
            type="text"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEditPrompt()}
            placeholder="Edit prompt..."
            autoFocus
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 10px",
              color: "#e0e0f0",
              fontSize: 12,
              outline: "none",
              fontFamily: "system-ui, sans-serif",
            }}
          />
          <button
            onClick={handleEditPrompt}
            style={{
              background: "rgba(120,130,255,0.2)",
              border: "none",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#a0a8ff",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <Send size={14} />
          </button>
          <button
            onClick={() => setShowPromptInput(false)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#666680",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {activeSubMenu === "tools" && (
        <SubMenu
          onClose={() => setActiveSubMenu(null)}
          items={[
            { icon: <ImageMinus size={14} />, label: "BG Remover", onClick: () => { handleAiTool("bg-remove"); setActiveSubMenu(null) } },
            { icon: <Eraser size={14} />, label: "Magic Eraser", onClick: () => { handleAiTool("eraser"); setActiveSubMenu(null) } },
            { icon: <Paintbrush size={14} />, label: "Magic Redraw", onClick: () => { handleAiTool("redraw"); setActiveSubMenu(null) } },
            { icon: <Expand size={14} />, label: "Image Expand", onClick: () => { handleAiTool("expand"); setActiveSubMenu(null) } },
            { icon: <ArrowUpFromLine size={14} />, label: "Upscale", onClick: () => { handleAiTool("upscale"); setActiveSubMenu(null) } },
            { icon: <Box size={14} />, label: "Product Mockup", onClick: () => { handleProductMockup(); setActiveSubMenu(null) } },
            ...(shape.props.sourceFormat !== "svg" && shape.props.imageUrl
              ? [{ icon: <Spline size={14} />, label: "Vectorize (SVG)", onClick: () => { handleVectorize(); setActiveSubMenu(null) } }]
              : []),
            ...(shape.props.sourceFormat === "svg"
              ? [{ icon: <Grid2X2 size={14} />, label: "Rasterize (PNG)", onClick: () => { handleRasterize(); setActiveSubMenu(null) } }]
              : []),
          ]}
        />
      )}

      {activeSubMenu === "add" && (
        <SubMenu
          onClose={() => setActiveSubMenu(null)}
          items={[
            { icon: <Type size={14} />, label: "Text", onClick: handleAddText },
            { icon: <Pencil size={14} />, label: "Doodle", onClick: () => { engine.setCurrentTool("draw"); setActiveSubMenu(null) } },
          ]}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "#1a1a2e",
          borderRadius: 10,
          padding: "4px 6px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <FloatBtn
          icon={<Send size={14} />}
          label="Edit Prompt"
          onClick={() => { setShowPromptInput(!showPromptInput); setActiveSubMenu(null) }}
          active={showPromptInput}
        />
        <FloatBtn
          icon={<Blend size={14} />}
          label="AI Tools"
          onClick={() => setActiveSubMenu(activeSubMenu === "tools" ? null : "tools")}
          active={activeSubMenu === "tools"}
        />
        <FloatBtn
          icon={<CopyPlus size={14} />}
          label="Add Elements"
          onClick={() => setActiveSubMenu(activeSubMenu === "add" ? null : "add")}
          active={activeSubMenu === "add"}
        />
        <FloatDivider />
        <FloatBtn icon={<Download size={14} />} label="Export" onClick={handleExport} />
        <FloatBtn icon={<Copy size={14} />} label="Copy Prompt" onClick={handleCopyPrompt} />
        <FloatBtn icon={<Shuffle size={14} />} label="Variations" onClick={handleVariations} />
        <FloatDivider />
        <FloatBtn icon={<Trash2 size={14} />} label="Delete" onClick={handleDelete} danger />
        {shape.props.sourceShapeIds && shape.props.sourceShapeIds.length > 0 && (
          <>
            <FloatDivider />
            <span style={{ fontSize: 10, color: "#8888aa", padding: "0 6px", whiteSpace: "nowrap" }}>
              {shape.props.sourceShapeIds.length} source{shape.props.sourceShapeIds.length !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function FrameToolbar({
  shapeId,
  x,
  y,
  shape,
}: {
  shapeId: string
  x: number
  y: number
  shape: any
}) {
  const engine = useCanvasEngine()
  const { addProcessingShape, removeProcessingShape, processingShapes, addGeneratedImage } = useAppStore()
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null)
  const isProcessing = processingShapes.has(shapeId)

  const handleResize = useCallback(
    (ratio: string) => {
      const presets: Record<string, { w: number; h: number }> = {
        "1:1": { w: 512, h: 512 },
        "16:9": { w: 768, h: 432 },
        "9:16": { w: 432, h: 768 },
      }
      const preset = presets[ratio]
      if (!preset) return
      engine.updateShape({
        id: shapeId,
        type: CANVAS_FRAME_TYPE,
        props: preset,
      })
      setActiveSubMenu(null)
    },
    [engine, shapeId]
  )

  const handleDuplicate = useCallback(() => {
    const bounds = engine.getShapePageBounds(shapeId)
    if (!bounds) return
    engine.createShape({
      type: CANVAS_FRAME_TYPE,
      x: bounds.x + bounds.w + 30,
      y: bounds.y,
      props: { ...shape.props },
    })
  }, [engine, shapeId, shape])

  const handleRemix = useCallback(async () => {
    addProcessingShape(shapeId)
    const bounds = engine.getShapePageBounds(shapeId)
    if (!bounds) return

    await mockDelay(1500, 2500)

    const seed = getNextSeed()
    const w = Math.round(shape.props.w)
    const h = Math.round(shape.props.h)
    const imageUrl = getPicsumUrl(w, h, seed)

    const newShape = engine.createShape({
      type: GENERATED_IMAGE_TYPE,
      x: bounds.x + bounds.w + 30,
      y: bounds.y,
      props: {
        w,
        h,
        imageUrl,
        prompt: "Remixed from frame",
        style: "Realistic",
        model: "Standard",
        aspectRatio: "1:1",
        seed,
        isLoading: false,
      },
    })

    addGeneratedImage({
      id: newShape.id,
      prompt: "Remixed from frame",
      model: "Standard",
      style: "Realistic",
      aspectRatio: "1:1",
      imageUrl,
      seed,
    })

    removeProcessingShape(shapeId)
  }, [shapeId, shape, engine, addProcessingShape, removeProcessingShape, addGeneratedImage])

  const handleAddText = useCallback(() => {
    const bounds = engine.getShapePageBounds(shapeId)
    if (!bounds) return
    engine.createShape({
      type: "text",
      x: bounds.x + 20,
      y: bounds.y + 40,
      props: {
        text: "Text",
        fontSize: 18,
        color: "#ffffff",
        w: 200,
        h: 40,
      },
    })
    setActiveSubMenu(null)
  }, [engine, shapeId])

  const handleDelete = useCallback(() => {
    engine.deleteShape(shapeId)
  }, [engine, shapeId])

  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y - 56,
        transform: "translateX(-50%)",
        zIndex: 400,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "all",
      }}
    >
      {isProcessing && (
        <div
          style={{
            position: "absolute",
            top: -28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a2e",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 11,
            color: "#a0a8ff",
            whiteSpace: "nowrap",
            border: "1px solid rgba(120, 130, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              border: "2px solid rgba(160, 168, 255, 0.3)",
              borderTopColor: "#a0a8ff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Remixing...
        </div>
      )}

      {activeSubMenu === "resize" && (
        <SubMenu
          onClose={() => setActiveSubMenu(null)}
          items={[
            { icon: <Square size={14} />, label: "Square (1:1)", onClick: () => handleResize("1:1") },
            { icon: <RectangleHorizontal size={14} />, label: "Wide (16:9)", onClick: () => handleResize("16:9") },
            { icon: <RectangleVertical size={14} />, label: "Tall (9:16)", onClick: () => handleResize("9:16") },
          ]}
        />
      )}

      {activeSubMenu === "add" && (
        <SubMenu
          onClose={() => setActiveSubMenu(null)}
          items={[
            { icon: <Type size={14} />, label: "Text", onClick: handleAddText },
            { icon: <Pencil size={14} />, label: "Doodle", onClick: () => { engine.setCurrentTool("draw"); setActiveSubMenu(null) } },
          ]}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "#1a1a2e",
          borderRadius: 10,
          padding: "4px 6px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <FloatBtn
          icon={<Expand size={14} />}
          label="Resize"
          onClick={() => setActiveSubMenu(activeSubMenu === "resize" ? null : "resize")}
          active={activeSubMenu === "resize"}
        />
        <FloatBtn icon={<CopyPlus size={14} />} label="Duplicate" onClick={handleDuplicate} />
        <FloatBtn
          icon={<ImageIcon size={14} />}
          label="Add Elements"
          onClick={() => setActiveSubMenu(activeSubMenu === "add" ? null : "add")}
          active={activeSubMenu === "add"}
        />
        <FloatDivider />
        <FloatBtn icon={<Blend size={14} />} label="Remix" onClick={handleRemix} />
        <FloatDivider />
        <FloatBtn icon={<Trash2 size={14} />} label="Delete" onClick={handleDelete} danger />
      </div>
    </div>
  )
}

function SubMenu({
  items,
  onClose,
}: {
  items: { icon: React.ReactNode; label: string; onClick: () => void }[]
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1a1a2e",
        borderRadius: 10,
        padding: 4,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 160,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            color: "#ccccdd",
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent"
          }}
        >
          <span style={{ color: "#8888aa", display: "flex" }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

function FloatBtn({
  icon,
  label,
  onClick,
  active = false,
  danger = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 7,
        border: "none",
        cursor: "pointer",
        color: danger ? "#ff6b6b" : active ? "#a0a8ff" : "#9999aa",
        background: active ? "rgba(120, 130, 255, 0.15)" : "transparent",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = danger
            ? "rgba(255,100,100,0.1)"
            : "rgba(255,255,255,0.06)"
          e.currentTarget.style.color = danger ? "#ff8888" : "#ccccdd"
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent"
          e.currentTarget.style.color = danger ? "#ff6b6b" : "#9999aa"
        }
      }}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  )
}

function FloatDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: "rgba(255,255,255,0.08)",
        margin: "0 2px",
      }}
    />
  )
}
