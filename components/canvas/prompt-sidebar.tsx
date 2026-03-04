"use client"

import React from "react"

import { useCanvasEngine } from "@/lib/canvas-engine"
import { GENERATED_IMAGE_TYPE } from "@/lib/canvas-engine/types"
import { useAppStore, getAspectDimensions, getNextSeed, getPicsumUrl, mockDelay } from "@/lib/store"
import type { AspectRatio, ModelOption, StyleOption } from "@/lib/store"
import {
  Sparkles,
  ChevronDown,
  Minus,
  Plus,
  X,
} from "lucide-react"
import { useCallback } from "react"

const MODELS: ModelOption[] = ["Standard", "HD", "Creative"]
const STYLES: StyleOption[] = [
  "Realistic",
  "Vector",
  "Illustration",
  "Watercolor",
  "3D Render",
]
const RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3"]

export function PromptSidebar() {
  const engine = useCanvasEngine()
  const {
    sidebarOpen,
    setSidebarOpen,
    promptText,
    setPromptText,
    selectedModel,
    setSelectedModel,
    selectedStyle,
    setSelectedStyle,
    selectedAspectRatio,
    setSelectedAspectRatio,
    imageCount,
    setImageCount,
    isGenerating,
    setIsGenerating,
    addGeneratedImage,
  } = useAppStore()

  const handleGenerate = useCallback(async () => {
    if (!promptText.trim() || isGenerating) return

    setIsGenerating(true)
    const dims = getAspectDimensions(selectedAspectRatio)
    const center = engine.getViewportScreenCenter()
    const point = engine.screenToPage(center)

    const shapeIds: string[] = []
    const totalWidth = imageCount * (dims.width + 20) - 20
    const startX = point.x - totalWidth / 2

    for (let i = 0; i < imageCount; i++) {
      const shape = engine.createShape({
        type: GENERATED_IMAGE_TYPE,
        x: startX + i * (dims.width + 20),
        y: point.y - dims.height / 2,
        props: {
          w: dims.width,
          h: dims.height,
          imageUrl: "",
          prompt: promptText,
          style: selectedStyle,
          model: selectedModel,
          aspectRatio: selectedAspectRatio,
          seed: 0,
          isLoading: true,
        },
      })
      shapeIds.push(shape.id)
    }

    await mockDelay(1200, 2200)

    for (const shapeId of shapeIds) {
      const seed = getNextSeed()
      const imageUrl = getPicsumUrl(dims.width, dims.height, seed)

      engine.updateShape({
        id: shapeId,
        type: GENERATED_IMAGE_TYPE,
        props: {
          imageUrl,
          seed,
          isLoading: false,
        },
      })

      addGeneratedImage({
        id: shapeId,
        prompt: promptText,
        model: selectedModel,
        style: selectedStyle,
        aspectRatio: selectedAspectRatio,
        imageUrl,
        seed,
      })
    }

    setIsGenerating(false)
  }, [
    promptText,
    isGenerating,
    selectedAspectRatio,
    selectedStyle,
    selectedModel,
    imageCount,
    engine,
    setIsGenerating,
    addGeneratedImage,
  ])

  if (!sidebarOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        bottom: 12,
        width: 320,
        zIndex: 300,
        background: "#12122a",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "all",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} style={{ color: "#a0a8ff" }} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#e0e0f0",
            }}
          >
            Generate
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          style={{
            background: "none",
            border: "none",
            color: "#666680",
            cursor: "pointer",
            display: "flex",
            padding: 4,
            borderRadius: 6,
          }}
          title="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Prompt */}
        <div>
          <SidebarLabel>Prompt</SidebarLabel>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Describe the image you want to create..."
            style={{
              width: "100%",
              minHeight: 100,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              color: "#e0e0f0",
              padding: "10px 12px",
              fontSize: 13,
              resize: "vertical",
              outline: "none",
              fontFamily: "system-ui, sans-serif",
              lineHeight: 1.5,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(120, 130, 255, 0.4)"
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
            }}
          />
        </div>

        {/* Model */}
        <div>
          <SidebarLabel>Model</SidebarLabel>
          <SelectDropdown
            value={selectedModel}
            options={MODELS}
            onChange={(v) => setSelectedModel(v as ModelOption)}
          />
        </div>

        {/* Style */}
        <div>
          <SidebarLabel>Style</SidebarLabel>
          <SelectDropdown
            value={selectedStyle}
            options={STYLES}
            onChange={(v) => setSelectedStyle(v as StyleOption)}
          />
        </div>

        {/* Aspect Ratio */}
        <div>
          <SidebarLabel>Aspect Ratio</SidebarLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {RATIOS.map((ratio) => (
              <button
                key={ratio}
                onClick={() => setSelectedAspectRatio(ratio)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor:
                    selectedAspectRatio === ratio
                      ? "rgba(120, 130, 255, 0.5)"
                      : "rgba(255,255,255,0.08)",
                  background:
                    selectedAspectRatio === ratio
                      ? "rgba(120, 130, 255, 0.12)"
                      : "rgba(255,255,255,0.03)",
                  color:
                    selectedAspectRatio === ratio ? "#a0a8ff" : "#9999aa",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                  transition: "all 0.15s ease",
                }}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Image Count */}
        <div>
          <SidebarLabel>Number of Images</SidebarLabel>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 10,
              padding: "6px 12px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <button
              onClick={() => setImageCount(Math.max(1, imageCount - 1))}
              disabled={imageCount <= 1}
              style={{
                background: "none",
                border: "none",
                color: imageCount <= 1 ? "#444460" : "#9999aa",
                cursor: imageCount <= 1 ? "not-allowed" : "pointer",
                display: "flex",
                padding: 4,
              }}
            >
              <Minus size={16} />
            </button>
            <span
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 14,
                fontWeight: 600,
                color: "#e0e0f0",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {imageCount}
            </span>
            <button
              onClick={() => setImageCount(Math.min(4, imageCount + 1))}
              disabled={imageCount >= 4}
              style={{
                background: "none",
                border: "none",
                color: imageCount >= 4 ? "#444460" : "#9999aa",
                cursor: imageCount >= 4 ? "not-allowed" : "pointer",
                display: "flex",
                padding: 4,
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={handleGenerate}
          disabled={!promptText.trim() || isGenerating}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 10,
            border: "none",
            background:
              !promptText.trim() || isGenerating
                ? "rgba(120, 130, 255, 0.2)"
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color:
              !promptText.trim() || isGenerating ? "#6666aa" : "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            cursor:
              !promptText.trim() || isGenerating ? "not-allowed" : "pointer",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s ease",
          }}
        >
          {isGenerating ? (
            <>
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#ffffff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#7777aa",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 8,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  )
}

function SelectDropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (val: string) => void
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 32px 10px 12px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          color: "#e0e0f0",
          fontSize: 13,
          fontFamily: "system-ui, sans-serif",
          cursor: "pointer",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background: "#1a1a2e", color: "#e0e0f0" }}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#7777aa",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
