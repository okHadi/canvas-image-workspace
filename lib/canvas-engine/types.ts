export type ToolId = "select" | "hand" | "draw" | "text"

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export interface CameraState {
  x: number
  y: number
  z: number // zoom level (1 = 100%)
}

// Shape type constants
export const GENERATED_IMAGE_TYPE = "generated-image" as const
export const CANVAS_FRAME_TYPE = "canvas-frame" as const
export const TEXT_TYPE = "text" as const
export const DRAW_TYPE = "draw" as const

export type ShapeType =
  | typeof GENERATED_IMAGE_TYPE
  | typeof CANVAS_FRAME_TYPE
  | typeof TEXT_TYPE
  | typeof DRAW_TYPE

export interface GeneratedImageProps {
  w: number
  h: number
  imageUrl: string
  prompt: string
  style: string
  model: string
  aspectRatio: string
  seed: number
  isLoading: boolean
  sourceFormat?: "raster" | "svg"
  sourceShapeIds?: string[]
}

export interface CanvasFrameProps {
  w: number
  h: number
  label: string
}

export interface TextProps {
  text: string
  fontSize: number
  color: string
  w: number
  h: number
}

export interface DrawProps {
  points: number[]
  color: string
  strokeWidth: number
  w: number
  h: number
}

export type ShapeProps = GeneratedImageProps | CanvasFrameProps | TextProps | DrawProps

export interface CanvasShape {
  id: string
  type: ShapeType
  x: number
  y: number
  props: ShapeProps
}

export interface CanvasEngine {
  // Shape CRUD
  createShape(partial: Partial<CanvasShape> & { type: ShapeType }): CanvasShape
  createShapes(partials: (Partial<CanvasShape> & { type: ShapeType })[]): CanvasShape[]
  updateShape(partial: { id: string; type?: ShapeType; x?: number; y?: number; props?: Partial<ShapeProps> }): void
  deleteShape(id: string): void
  getShape(id: string): CanvasShape | undefined
  getAllShapes(): CanvasShape[]

  // Selection
  getSelectedShapeIds(): string[]
  selectShape(id: string): void
  toggleShapeSelection(id: string, maxSelection?: number): void
  deselectAll(): void

  // Tools
  setCurrentTool(tool: ToolId): void
  getCurrentToolId(): ToolId

  // Camera
  getCamera(): CameraState
  setCamera(camera: Partial<CameraState>): void
  zoomIn(center?: Point): void
  zoomOut(center?: Point): void
  zoomToFit(): void

  // Coordinate transforms
  getViewportScreenCenter(): Point
  screenToPage(screenPoint: Point): Point
  pageToScreen(pagePoint: Point): Point

  // Bounds
  getShapePageBounds(id: string): Bounds | null

  // Subscriptions
  subscribe(callback: () => void): () => void

  // Stage dimensions (for Konva)
  getStageSize(): { width: number; height: number }
}
