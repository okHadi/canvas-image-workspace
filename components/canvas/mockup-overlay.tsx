"use client"

import React, { useRef, useEffect, useCallback, useState } from "react"
import { useCanvasEngine } from "@/lib/canvas-engine"
import { GENERATED_IMAGE_TYPE } from "@/lib/canvas-engine/types"
import { useAppStore } from "@/lib/store"
import { renderWarpedOverlay } from "@/lib/mockup-warp"
import { Upload, Check, X, ImageIcon } from "lucide-react"

const PREVIEW_WIDTH = 400
const PREVIEW_HEIGHT = 400

export function MockupOverlay() {
  const engine = useCanvasEngine()
  const {
    mockupMode,
    activeMockupShapeId,
    mockupShapes,
    setMockupOverlay,
    updateOverlayPosition,
    updateOverlayScale,
    updateOverlayOpacity,
    clearMockup,
  } = useAppStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDragging = useRef(false)
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null)

  const shapeId = activeMockupShapeId
  const mockupData = shapeId ? mockupShapes.get(shapeId) : null

  // Load base image from the shape
  useEffect(() => {
    if (!shapeId || !mockupMode) return
    const shape = engine.getShape(shapeId)
    if (!shape || shape.type !== GENERATED_IMAGE_TYPE) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => setBaseImage(img)
    img.src = (shape.props as any).imageUrl
  }, [shapeId, mockupMode, engine])

  // Render the canvas preview
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !baseImage || !mockupData) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Fit base image to preview
    const imgAspect = baseImage.naturalWidth / baseImage.naturalHeight
    let drawW = PREVIEW_WIDTH
    let drawH = PREVIEW_WIDTH / imgAspect
    if (drawH > PREVIEW_HEIGHT) {
      drawH = PREVIEW_HEIGHT
      drawW = PREVIEW_HEIGHT * imgAspect
    }
    const offsetX = (PREVIEW_WIDTH - drawW) / 2
    const offsetY = (PREVIEW_HEIGHT - drawH) / 2

    canvas.width = PREVIEW_WIDTH
    canvas.height = PREVIEW_HEIGHT

    ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)
    ctx.fillStyle = "#111122"
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)

    // Draw base image
    ctx.drawImage(baseImage, offsetX, offsetY, drawW, drawH)

    // Draw warped overlay if we have one
    if (mockupData.overlayImageElement) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(offsetX, offsetY, drawW, drawH)
      ctx.clip()

      renderWarpedOverlay({
        ctx,
        overlayImg: mockupData.overlayImageElement,
        depthData: mockupData.depthData,
        depthWidth: mockupData.depthWidth,
        depthHeight: mockupData.depthHeight,
        canvasWidth: drawW,
        canvasHeight: drawH,
        overlayX: mockupData.overlayX,
        overlayY: mockupData.overlayY,
        overlayScale: mockupData.overlayScale,
        overlayOpacity: mockupData.overlayOpacity,
        garmentMask: mockupData.garmentMask,
        garmentMaskWidth: mockupData.garmentMaskWidth,
        garmentMaskHeight: mockupData.garmentMaskHeight,
      })

      ctx.restore()
    }
  }, [baseImage, mockupData])

  // Re-render on any change
  useEffect(() => {
    const id = requestAnimationFrame(renderPreview)
    return () => cancelAnimationFrame(id)
  }, [renderPreview])

  // Handle design upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !shapeId) return

      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        setMockupOverlay(shapeId, url, img)
      }
      img.src = url
    },
    [shapeId, setMockupOverlay]
  )

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (!file || !shapeId || !file.type.startsWith("image/")) return

      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        setMockupOverlay(shapeId, url, img)
      }
      img.src = url
    },
    [shapeId, setMockupOverlay]
  )

  // Mouse drag on canvas to reposition overlay
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mockupData?.overlayImageElement) return
      isDragging.current = true
      e.preventDefault()
    },
    [mockupData]
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current || !shapeId || !mockupData) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width
      const ny = (e.clientY - rect.top) / rect.height
      updateOverlayPosition(shapeId, Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)))
    },
    [shapeId, mockupData, updateOverlayPosition]
  )

  const handleCanvasMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Apply: flatten result onto the shape
  const handleApply = useCallback(() => {
    if (!canvasRef.current || !shapeId) return

    // Render at full resolution
    const shape = engine.getShape(shapeId)
    if (!shape) return

    const w = (shape.props as any).w
    const h = (shape.props as any).h

    const offscreen = document.createElement("canvas")
    offscreen.width = w
    offscreen.height = h
    const octx = offscreen.getContext("2d")
    if (!octx || !baseImage || !mockupData) return

    // Draw base image at full size
    octx.drawImage(baseImage, 0, 0, w, h)

    // Draw warped overlay at full size
    if (mockupData.overlayImageElement) {
      renderWarpedOverlay({
        ctx: octx,
        overlayImg: mockupData.overlayImageElement,
        depthData: mockupData.depthData,
        depthWidth: mockupData.depthWidth,
        depthHeight: mockupData.depthHeight,
        canvasWidth: w,
        canvasHeight: h,
        overlayX: mockupData.overlayX,
        overlayY: mockupData.overlayY,
        overlayScale: mockupData.overlayScale,
        overlayOpacity: mockupData.overlayOpacity,
        garmentMask: mockupData.garmentMask,
        garmentMaskWidth: mockupData.garmentMaskWidth,
        garmentMaskHeight: mockupData.garmentMaskHeight,
      })
    }

    const dataUrl = offscreen.toDataURL("image/png")

    engine.updateShape({
      id: shapeId,
      type: GENERATED_IMAGE_TYPE,
      props: { imageUrl: dataUrl },
    })

    clearMockup(shapeId)
  }, [shapeId, engine, baseImage, mockupData, clearMockup])

  const handleClose = useCallback(() => {
    if (shapeId) clearMockup(shapeId)
  }, [shapeId, clearMockup])

  if (!mockupMode || !shapeId || !mockupData) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        right: 20,
        width: 440,
        background: "#1a1a2e",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 500,
        fontFamily: "system-ui, sans-serif",
        color: "#e0e0f0",
        overflow: "hidden",
        pointerEvents: "all",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Product Mockup</span>
        <button
          onClick={handleClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#666680",
            cursor: "pointer",
            display: "flex",
            padding: 4,
            borderRadius: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#ccccdd" }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#666680" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Canvas Preview */}
      <div
        style={{ padding: "12px 16px" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          style={{
            width: "100%",
            height: "auto",
            borderRadius: 8,
            cursor: mockupData.overlayImageElement ? "grab" : "default",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>

      {/* Upload */}
      <div style={{ padding: "0 16px 12px" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "100%",
            padding: "10px 0",
            background: mockupData.overlayImageElement
              ? "rgba(255,255,255,0.04)"
              : "rgba(120,130,255,0.15)",
            border: "1px dashed rgba(120,130,255,0.3)",
            borderRadius: 8,
            color: "#a0a8ff",
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {mockupData.overlayImageElement ? (
            <>
              <ImageIcon size={14} />
              Change Design Image
            </>
          ) : (
            <>
              <Upload size={14} />
              Upload Design Image (or drag & drop)
            </>
          )}
        </button>
      </div>

      {/* Sliders */}
      <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        <SliderControl
          label="Scale"
          value={mockupData.overlayScale}
          min={0.05}
          max={1}
          step={0.01}
          onChange={(v) => shapeId && updateOverlayScale(shapeId, v)}
        />
        <SliderControl
          label="Opacity"
          value={mockupData.overlayOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => shapeId && updateOverlayOpacity(shapeId, v)}
        />
      </div>

      {/* Depth map preview */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ fontSize: 11, color: "#666680", marginBottom: 4 }}>Depth Map</div>
        <img
          src={mockupData.depthMapUrl}
          alt="Depth map"
          style={{
            width: "100%",
            height: "auto",
            objectFit: "contain",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      </div>

      {/* Garment mask preview */}
      {mockupData.garmentMaskUrl && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ fontSize: 11, color: "#666680", marginBottom: 4 }}>Garment Mask</div>
          <img
            src={mockupData.garmentMaskUrl}
            alt="Garment mask"
            style={{
              width: "100%",
              height: "auto",
              objectFit: "contain",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={handleApply}
          disabled={!mockupData.overlayImageElement}
          style={{
            flex: 1,
            padding: "10px 0",
            background: mockupData.overlayImageElement
              ? "rgba(120,130,255,0.2)"
              : "rgba(255,255,255,0.04)",
            border: "none",
            borderRadius: 8,
            color: mockupData.overlayImageElement ? "#a0a8ff" : "#444455",
            fontSize: 12,
            fontWeight: 600,
            cursor: mockupData.overlayImageElement ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <Check size={14} />
          Apply
        </button>
        <button
          onClick={handleClose}
          style={{
            padding: "10px 20px",
            background: "rgba(255,255,255,0.04)",
            border: "none",
            borderRadius: 8,
            color: "#888899",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, color: "#888899", width: 50, flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          accentColor: "#7882ff",
          height: 4,
        }}
      />
      <span style={{ fontSize: 11, color: "#666680", width: 32, textAlign: "right" }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}
