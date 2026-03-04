import { create } from "zustand"
import type { CanvasShape, CameraState, ToolId } from "@/lib/canvas-engine/types"

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3"
export type ModelOption = "Standard" | "HD" | "Creative"
export type StyleOption =
  | "Realistic"
  | "Vector"
  | "Illustration"
  | "Watercolor"
  | "3D Render"

export interface MockupData {
  depthMapUrl: string // data URL for preview
  depthData: Float32Array
  depthWidth: number
  depthHeight: number
  garmentMaskUrl: string | null
  garmentMask: Uint8Array | null
  garmentMaskWidth: number
  garmentMaskHeight: number
  overlayImageUrl: string | null
  overlayImageElement: HTMLImageElement | null
  overlayX: number // 0-1 normalized
  overlayY: number // 0-1 normalized
  overlayScale: number
  overlayOpacity: number
}

export interface GeneratedImageMeta {
  id: string
  prompt: string
  model: ModelOption
  style: StyleOption
  aspectRatio: AspectRatio
  imageUrl: string
  seed: number
}

interface AppState {
  // --- Canvas engine state ---
  shapes: Map<string, CanvasShape>
  selectedShapeIds: Set<string>
  currentTool: ToolId
  camera: CameraState

  addShape: (shape: CanvasShape) => void
  updateShapeInStore: (shape: CanvasShape) => void
  removeShape: (id: string) => void
  setSelectedShapeIds: (ids: Set<string>) => void
  setCurrentTool: (tool: ToolId) => void
  setCamera: (camera: CameraState) => void

  // --- Existing app state ---
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  promptText: string
  setPromptText: (text: string) => void

  selectedModel: ModelOption
  setSelectedModel: (model: ModelOption) => void

  selectedStyle: StyleOption
  setSelectedStyle: (style: StyleOption) => void

  selectedAspectRatio: AspectRatio
  setSelectedAspectRatio: (ratio: AspectRatio) => void

  imageCount: number
  setImageCount: (count: number) => void

  isGenerating: boolean
  setIsGenerating: (generating: boolean) => void

  generatedImages: Map<string, GeneratedImageMeta>
  addGeneratedImage: (meta: GeneratedImageMeta) => void
  removeGeneratedImage: (id: string) => void
  getGeneratedImage: (id: string) => GeneratedImageMeta | undefined

  activeToolbarShapeId: string | null
  setActiveToolbarShapeId: (id: string | null) => void

  processingShapes: Set<string>
  addProcessingShape: (id: string) => void
  removeProcessingShape: (id: string) => void

  brushMode: "eraser" | "redraw" | null
  setBrushMode: (mode: "eraser" | "redraw" | null) => void
  brushTargetShapeId: string | null
  setBrushTargetShapeId: (id: string | null) => void

  mockupMode: boolean
  activeMockupShapeId: string | null
  mockupShapes: Map<string, MockupData>
  setMockupDepth: (shapeId: string, depthMapUrl: string, depthData: Float32Array, depthWidth: number, depthHeight: number, garmentMaskUrl?: string | null, garmentMask?: Uint8Array | null, garmentMaskWidth?: number, garmentMaskHeight?: number) => void
  setMockupOverlay: (shapeId: string, imageUrl: string, imageElement: HTMLImageElement) => void
  updateOverlayPosition: (shapeId: string, x: number, y: number) => void
  updateOverlayScale: (shapeId: string, scale: number) => void
  updateOverlayOpacity: (shapeId: string, opacity: number) => void
  clearMockup: (shapeId: string) => void
  setMockupMode: (active: boolean, shapeId?: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // --- Canvas engine state ---
  shapes: new Map(),
  selectedShapeIds: new Set(),
  currentTool: "select" as ToolId,
  camera: { x: 0, y: 0, z: 1 },

  addShape: (shape) =>
    set((s) => {
      const newMap = new Map(s.shapes)
      newMap.set(shape.id, shape)
      return { shapes: newMap }
    }),
  updateShapeInStore: (shape) =>
    set((s) => {
      const newMap = new Map(s.shapes)
      newMap.set(shape.id, shape)
      return { shapes: newMap }
    }),
  removeShape: (id) =>
    set((s) => {
      const newMap = new Map(s.shapes)
      newMap.delete(id)
      return { shapes: newMap }
    }),
  setSelectedShapeIds: (ids) => set({ selectedShapeIds: ids }),
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setCamera: (camera) => set({ camera }),

  // --- Existing app state ---
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  promptText: "",
  setPromptText: (text) => set({ promptText: text }),

  selectedModel: "Standard",
  setSelectedModel: (model) => set({ selectedModel: model }),

  selectedStyle: "Realistic",
  setSelectedStyle: (style) => set({ selectedStyle: style }),

  selectedAspectRatio: "1:1",
  setSelectedAspectRatio: (ratio) => set({ selectedAspectRatio: ratio }),

  imageCount: 1,
  setImageCount: (count) => set({ imageCount: count }),

  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),

  generatedImages: new Map(),
  addGeneratedImage: (meta) =>
    set((s) => {
      const newMap = new Map(s.generatedImages)
      newMap.set(meta.id, meta)
      return { generatedImages: newMap }
    }),
  removeGeneratedImage: (id) =>
    set((s) => {
      const newMap = new Map(s.generatedImages)
      newMap.delete(id)
      return { generatedImages: newMap }
    }),
  getGeneratedImage: (id) => get().generatedImages.get(id),

  activeToolbarShapeId: null,
  setActiveToolbarShapeId: (id) => set({ activeToolbarShapeId: id }),

  processingShapes: new Set(),
  addProcessingShape: (id) =>
    set((s) => {
      const newSet = new Set(s.processingShapes)
      newSet.add(id)
      return { processingShapes: newSet }
    }),
  removeProcessingShape: (id) =>
    set((s) => {
      const newSet = new Set(s.processingShapes)
      newSet.delete(id)
      return { processingShapes: newSet }
    }),

  brushMode: null,
  setBrushMode: (mode) => set({ brushMode: mode }),
  brushTargetShapeId: null,
  setBrushTargetShapeId: (id) => set({ brushTargetShapeId: id }),

  mockupMode: false,
  activeMockupShapeId: null,
  mockupShapes: new Map(),
  setMockupDepth: (shapeId, depthMapUrl, depthData, depthWidth, depthHeight, garmentMaskUrl = null, garmentMask = null, garmentMaskWidth = 0, garmentMaskHeight = 0) =>
    set((s) => {
      const newMap = new Map(s.mockupShapes)
      newMap.set(shapeId, {
        depthMapUrl,
        depthData,
        depthWidth,
        depthHeight,
        garmentMaskUrl,
        garmentMask,
        garmentMaskWidth,
        garmentMaskHeight,
        overlayImageUrl: null,
        overlayImageElement: null,
        overlayX: 0.5,
        overlayY: 0.5,
        overlayScale: 0.4,
        overlayOpacity: 0.9,
      })
      return { mockupShapes: newMap, mockupMode: true, activeMockupShapeId: shapeId }
    }),
  setMockupOverlay: (shapeId, imageUrl, imageElement) =>
    set((s) => {
      const newMap = new Map(s.mockupShapes)
      const existing = newMap.get(shapeId)
      if (existing) {
        newMap.set(shapeId, { ...existing, overlayImageUrl: imageUrl, overlayImageElement: imageElement })
      }
      return { mockupShapes: newMap }
    }),
  updateOverlayPosition: (shapeId, x, y) =>
    set((s) => {
      const newMap = new Map(s.mockupShapes)
      const existing = newMap.get(shapeId)
      if (existing) {
        newMap.set(shapeId, { ...existing, overlayX: x, overlayY: y })
      }
      return { mockupShapes: newMap }
    }),
  updateOverlayScale: (shapeId, scale) =>
    set((s) => {
      const newMap = new Map(s.mockupShapes)
      const existing = newMap.get(shapeId)
      if (existing) {
        newMap.set(shapeId, { ...existing, overlayScale: scale })
      }
      return { mockupShapes: newMap }
    }),
  updateOverlayOpacity: (shapeId, opacity) =>
    set((s) => {
      const newMap = new Map(s.mockupShapes)
      const existing = newMap.get(shapeId)
      if (existing) {
        newMap.set(shapeId, { ...existing, overlayOpacity: opacity })
      }
      return { mockupShapes: newMap }
    }),
  clearMockup: (shapeId) =>
    set((s) => {
      const newMap = new Map(s.mockupShapes)
      newMap.delete(shapeId)
      return {
        mockupShapes: newMap,
        mockupMode: false,
        activeMockupShapeId: null,
      }
    }),
  setMockupMode: (active, shapeId = null) =>
    set({ mockupMode: active, activeMockupShapeId: shapeId ?? null }),
}))

export function getAspectDimensions(ratio: AspectRatio): {
  width: number
  height: number
} {
  switch (ratio) {
    case "1:1":
      return { width: 512, height: 512 }
    case "16:9":
      return { width: 768, height: 432 }
    case "9:16":
      return { width: 432, height: 768 }
    case "4:3":
      return { width: 640, height: 480 }
  }
}

let seedCounter = 1
export function getNextSeed(): number {
  return seedCounter++
}

export function mockDelay(min = 1000, max = 2000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getPicsumUrl(
  width: number,
  height: number,
  seed: number
): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`
}
