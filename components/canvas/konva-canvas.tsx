"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { Stage, Layer, Circle, Transformer, Rect, Line } from "react-konva"
import { useCanvasEngine, useCanvasValue } from "@/lib/canvas-engine"
import { ShapeRenderer } from "./shapes/shape-renderer"
import type { CanvasShape, DrawProps, GeneratedImageProps, CanvasFrameProps } from "@/lib/canvas-engine/types"
import { CANVAS_FRAME_TYPE } from "@/lib/canvas-engine/types"
import { useAppStore } from "@/lib/store"
import type Konva from "konva"

const GRID_SPACING = 40
const GRID_DOT_RADIUS = 1
const GRID_DOT_FILL = "rgba(255,255,255,0.15)"

export function KonvaCanvas() {
  const engine = useCanvasEngine()
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const drawingShapeIdRef = useRef<string | null>(null)

  const shapes = useCanvasValue("shapes", (e) => e.getAllShapes(), [])
  const selectedIds = useCanvasValue("selected", (e) => e.getSelectedShapeIds(), [])
  const currentTool = useCanvasValue("tool", (e) => e.getCurrentToolId(), [])
  const camera = useCanvasValue("camera", (e) => e.getCamera(), [])

  const showProvenanceLines = useAppStore((s) => s.showProvenanceLines)

  // Spacebar hold: temporary hand tool
  const prevToolRef = useRef<string | null>(null)
  // Hovered frame for magnetic snap visual feedback
  const [hoveredFrameId, setHoveredFrameId] = useState<string | null>(null)
  // Track whether a shape is being dragged (for hover frame detection)
  const isDraggingShapeRef = useRef(false)

  // Marquee selection state
  const marqueeRef = useRef<{ startX: number; startY: number; active: boolean }>({ startX: 0, startY: 0, active: false })
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const marqueeRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const skipClickDeselectRef = useRef(false)

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName.toLowerCase()
      return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return

      // Spacebar hold → temporary hand tool
      if (e.key === " " && !e.repeat) {
        e.preventDefault()
        prevToolRef.current = engine.getCurrentToolId()
        engine.setCurrentTool("hand")
        return
      }

      const key = e.key.toLowerCase()

      if (key === "v") { engine.setCurrentTool("select"); return }
      if (key === "h") { engine.setCurrentTool("hand"); return }
      if (key === "d") { engine.setCurrentTool("draw"); return }
      if (key === "escape") { engine.deselectAll(); return }
      if (key === "delete" || key === "backspace") {
        e.preventDefault()
        const ids = engine.getSelectedShapeIds()
        for (const id of ids) engine.deleteShape(id)
        return
      }
      if (key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        engine.selectShapes(engine.getAllShapes().map((s) => s.id))
        return
      }
      // Shift+1 → zoom to fit
      if (key === "!" || (e.shiftKey && key === "1")) {
        engine.zoomToFit()
        return
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && prevToolRef.current !== null) {
        engine.setCurrentTool(prevToolRef.current as any)
        prevToolRef.current = null
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [engine])

  // Attach transformer to selected nodes
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return

    if (selectedIds.length === 0) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }

    const nodes: Konva.Node[] = []
    for (const id of selectedIds) {
      const node = stage.findOne("#" + id)
      if (node) nodes.push(node)
    }
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, shapes])

  // Wheel zoom (pointer-relative)
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      if (e.evt.ctrlKey || e.evt.metaKey) {
        // Pinch-to-zoom (or Ctrl+scroll)
        const pointer = stage.getPointerPosition()
        if (!pointer) return

        const oldScale = camera.z
        const scaleBy = 1.08
        const direction = e.evt.deltaY > 0 ? -1 : 1
        const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
        const clampedScale = Math.max(0.1, Math.min(8, newScale))

        const mousePointTo = {
          x: (pointer.x - camera.x) / oldScale,
          y: (pointer.y - camera.y) / oldScale,
        }

        engine.setCamera({
          x: pointer.x - mousePointTo.x * clampedScale,
          y: pointer.y - mousePointTo.y * clampedScale,
          z: clampedScale,
        })
      } else {
        // Two-finger swipe / mouse scroll → pan the canvas
        engine.setCamera({
          x: camera.x - e.evt.deltaX,
          y: camera.y - e.evt.deltaY,
          z: camera.z,
        })
      }
    },
    [engine, camera]
  )

  // Click on empty area to deselect
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (skipClickDeselectRef.current) {
        skipClickDeselectRef.current = false
        return
      }
      if (e.target === stageRef.current || e.target.getClassName() === "Rect" && e.target.id() === "background") {
        engine.deselectAll()
      }
    },
    [engine]
  )

  // Shape selection (debounced to prevent onClick + onTap double-fire)
  const lastSelectRef = useRef<{ id: string; time: number }>({ id: "", time: 0 })
  const handleShapeSelect = useCallback(
    (id: string, nativeEvent?: MouseEvent) => {
      const now = Date.now()
      if (lastSelectRef.current.id === id && now - lastSelectRef.current.time < 100) return
      lastSelectRef.current = { id, time: now }

      if (currentTool === "select") {
        if (nativeEvent && (nativeEvent.shiftKey || nativeEvent.metaKey)) {
          engine.toggleShapeSelection(id, 10)
        } else {
          engine.selectShape(id)
        }
      }
    },
    [engine, currentTool]
  )

  // Shape drag end — with frame snap / breakout
  const handleShapeDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      isDraggingShapeRef.current = false
      setHoveredFrameId(null)

      const shape = engine.getShape(id)
      if (!shape) { engine.updateShape({ id, x, y }); return }

      const props = shape.props as any
      const sw = props.w || 100
      const sh = props.h || 40
      const cx = x + sw / 2
      const cy = y + sh / 2

      const frames = engine.getAllShapes().filter(
        (s) => s.type === CANVAS_FRAME_TYPE && s.id !== id
      )

      // Check if center is inside any frame
      let snappedFrameId: string | undefined
      for (const frame of frames) {
        const fp = frame.props as CanvasFrameProps
        if (
          cx >= frame.x &&
          cx <= frame.x + fp.w &&
          cy >= frame.y &&
          cy <= frame.y + fp.h
        ) {
          snappedFrameId = frame.id
          break
        }
      }

      // Breakout check: if already in a frame, compute overlap
      if (shape.parentFrameId && !snappedFrameId) {
        const parentFrame = engine.getShape(shape.parentFrameId)
        if (parentFrame) {
          const fp = parentFrame.props as CanvasFrameProps
          const overlapX = Math.max(0, Math.min(x + sw, parentFrame.x + fp.w) - Math.max(x, parentFrame.x))
          const overlapY = Math.max(0, Math.min(y + sh, parentFrame.y + fp.h) - Math.max(y, parentFrame.y))
          const overlapArea = overlapX * overlapY
          const shapeArea = sw * sh
          if (shapeArea > 0 && overlapArea / shapeArea >= 0.5) {
            // Still mostly inside — keep parent
            snappedFrameId = shape.parentFrameId
          }
        }
      }

      engine.updateShape({ id, x, y, parentFrameId: snappedFrameId })
    },
    [engine]
  )

  // Text change
  const handleTextChange = useCallback(
    (id: string, text: string) => {
      engine.updateShape({ id, props: { text } })
    },
    [engine]
  )

  // Transform end - update shape dimensions after resize
  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current
    if (!tr) return

    for (const node of tr.nodes()) {
      const id = node.id()
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      const shape = engine.getShape(id)
      if (!shape) continue

      const props = shape.props as any
      if (props.w !== undefined && props.h !== undefined) {
        engine.updateShape({
          id,
          x: node.x(),
          y: node.y(),
          props: {
            w: Math.max(20, Math.round(props.w * scaleX)),
            h: Math.max(20, Math.round(props.h * scaleY)),
          },
        })
      }

      // Reset scale
      node.scaleX(1)
      node.scaleY(1)
    }
  }, [engine])

  // Draw tool handlers + marquee selection
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return

      // Marquee selection: start when clicking empty space with select tool
      if (currentTool === "select") {
        const target = e.target
        const isEmptyArea = target === stage || (target.getClassName() === "Rect" && target.id() === "background")
        if (isEmptyArea) {
          const pointer = stage.getPointerPosition()
          if (pointer) {
            const pagePoint = engine.screenToPage(pointer)
            marqueeRef.current = { startX: pagePoint.x, startY: pagePoint.y, active: true }
            const rect = { x: pagePoint.x, y: pagePoint.y, w: 0, h: 0 }
            marqueeRectRef.current = rect
            setMarqueeRect(rect)
          }
        }
        return
      }

      if (currentTool !== "draw") return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const pagePoint = engine.screenToPage(pointer)

      const shape = engine.createShape({
        type: "draw",
        x: pagePoint.x,
        y: pagePoint.y,
        props: {
          points: [0, 0],
          color: "#ffffff",
          strokeWidth: 3,
          w: 0,
          h: 0,
        },
      })
      drawingShapeIdRef.current = shape.id
    },
    [engine, currentTool]
  )

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return

      // Hover frame detection while dragging a shape
      if (isDraggingShapeRef.current) {
        const pointer = stage.getPointerPosition()
        if (pointer) {
          const pagePoint = engine.screenToPage(pointer)
          const frames = engine.getAllShapes().filter((s) => s.type === CANVAS_FRAME_TYPE)
          let found: string | null = null
          for (const frame of frames) {
            const fp = frame.props as CanvasFrameProps
            if (
              pagePoint.x >= frame.x &&
              pagePoint.x <= frame.x + fp.w &&
              pagePoint.y >= frame.y &&
              pagePoint.y <= frame.y + fp.h
            ) {
              found = frame.id
              break
            }
          }
          setHoveredFrameId(found)
        }
      }

      // Marquee drag
      if (marqueeRef.current.active && currentTool === "select") {
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        const pagePoint = engine.screenToPage(pointer)
        const sx = marqueeRef.current.startX
        const sy = marqueeRef.current.startY
        const rect = {
          x: Math.min(sx, pagePoint.x),
          y: Math.min(sy, pagePoint.y),
          w: Math.abs(pagePoint.x - sx),
          h: Math.abs(pagePoint.y - sy),
        }
        marqueeRectRef.current = rect
        setMarqueeRect(rect)
        return
      }

      if (currentTool !== "draw" || !drawingShapeIdRef.current) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const drawShape = engine.getShape(drawingShapeIdRef.current)
      if (!drawShape) return

      const pagePoint = engine.screenToPage(pointer)
      const relX = pagePoint.x - drawShape.x
      const relY = pagePoint.y - drawShape.y

      const drawProps = drawShape.props as DrawProps
      const newPoints = [...drawProps.points, relX, relY]
      engine.updateShape({
        id: drawingShapeIdRef.current,
        props: { points: newPoints },
      })
    },
    [engine, currentTool]
  )

  const handleMouseUp = useCallback(() => {
    // Finish marquee selection
    if (marqueeRef.current.active) {
      marqueeRef.current.active = false
      const rect = marqueeRectRef.current
      if (rect && (rect.w > 5 || rect.h > 5)) {
        // Find all shapes that intersect the marquee rectangle
        const allShapes = engine.getAllShapes()
        const hits: string[] = []
        for (const shape of allShapes) {
          const bounds = engine.getShapePageBounds(shape.id)
          if (!bounds) continue
          // Check overlap
          const overlapX = rect.x < bounds.x + bounds.w && rect.x + rect.w > bounds.x
          const overlapY = rect.y < bounds.y + bounds.h && rect.y + rect.h > bounds.y
          if (overlapX && overlapY) {
            hits.push(shape.id)
          }
        }
        if (hits.length > 0) {
          engine.selectShapes(hits)
          skipClickDeselectRef.current = true
        }
      }
      marqueeRectRef.current = null
      setMarqueeRect(null)
      return
    }

    if (currentTool === "draw" && drawingShapeIdRef.current) {
      const drawShape = engine.getShape(drawingShapeIdRef.current)
      if (drawShape) {
        const drawProps = drawShape.props as DrawProps
        if (drawProps.points.length < 4) {
          engine.deleteShape(drawingShapeIdRef.current)
        } else {
          // Compute bounding box for the points
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (let i = 0; i < drawProps.points.length; i += 2) {
            minX = Math.min(minX, drawProps.points[i])
            minY = Math.min(minY, drawProps.points[i + 1])
            maxX = Math.max(maxX, drawProps.points[i])
            maxY = Math.max(maxY, drawProps.points[i + 1])
          }
          engine.updateShape({
            id: drawingShapeIdRef.current,
            props: { w: maxX - minX, h: maxY - minY },
          })
        }
      }
      drawingShapeIdRef.current = null
    }
  }, [engine, currentTool])

  // Track shape drag start at stage level
  const handleStageDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target !== stageRef.current) {
        isDraggingShapeRef.current = true
      }
    },
    []
  )

  // Hand tool - stage dragging
  const isHandTool = currentTool === "hand"

  const handleStageDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!isHandTool) return
      if (e.target !== stageRef.current) return
      engine.setCamera({
        x: e.target.x(),
        y: e.target.y(),
        z: camera.z,
      })
    },
    [engine, isHandTool, camera.z]
  )

  // Generate grid dots
  const gridDots = React.useMemo(() => {
    const dots: { x: number; y: number }[] = []
    const startX = Math.floor((-camera.x / camera.z) / GRID_SPACING) * GRID_SPACING - GRID_SPACING
    const startY = Math.floor((-camera.y / camera.z) / GRID_SPACING) * GRID_SPACING - GRID_SPACING
    const endX = startX + (stageSize.width / camera.z) + GRID_SPACING * 2
    const endY = startY + (stageSize.height / camera.z) + GRID_SPACING * 2

    for (let x = startX; x < endX; x += GRID_SPACING) {
      for (let y = startY; y < endY; y += GRID_SPACING) {
        dots.push({ x, y })
      }
    }
    return dots
  }, [camera.x, camera.y, camera.z, stageSize.width, stageSize.height])

  // Cursor style
  let cursorStyle = "default"
  if (currentTool === "hand") cursorStyle = "grab"
  if (currentTool === "draw") cursorStyle = "crosshair"

  const isDraggable = currentTool === "select"

  return (
    <div style={{ width: "100%", height: "100%", cursor: cursorStyle }}>
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={isHandTool ? camera.x : camera.x}
        y={isHandTool ? camera.y : camera.y}
        scaleX={camera.z}
        scaleY={camera.z}
        draggable={isHandTool}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragStart={handleStageDragStart}
        onDragEnd={handleStageDragEnd}
      >
        {/* Grid layer */}
        <Layer listening={false}>
          {gridDots.map((dot, i) => (
            <Circle
              key={i}
              x={dot.x}
              y={dot.y}
              radius={GRID_DOT_RADIUS / camera.z}
              fill={GRID_DOT_FILL}
            />
          ))}
        </Layer>

        {/* Shapes layer */}
        <Layer>
          {shapes.map((shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              isSelected={selectedIds.includes(shape.id)}
              onSelect={handleShapeSelect}
              onDragEnd={handleShapeDragEnd}
              onTextChange={handleTextChange}
              isDraggable={isDraggable}
            />
          ))}

          {/* Provenance lines */}
          {showProvenanceLines && shapes.map((shape) => {
            const props = shape.props as GeneratedImageProps
            if (!props.sourceShapeIds || props.sourceShapeIds.length === 0) return null
            const targetBounds = engine.getShapePageBounds(shape.id)
            if (!targetBounds) return null
            const targetCx = targetBounds.x + targetBounds.w / 2
            const targetCy = targetBounds.y + targetBounds.h / 2
            return props.sourceShapeIds.map((srcId) => {
              const srcBounds = engine.getShapePageBounds(srcId)
              if (!srcBounds) return null
              const srcCx = srcBounds.x + srcBounds.w / 2
              const srcCy = srcBounds.y + srcBounds.h / 2
              return (
                <Line
                  key={`prov-${srcId}-${shape.id}`}
                  points={[srcCx, srcCy, targetCx, targetCy]}
                  stroke="rgba(120,130,255,0.3)"
                  strokeWidth={1.5 / camera.z}
                  dash={[8 / camera.z, 4 / camera.z]}
                  listening={false}
                />
              )
            })
          })}

          {/* Marquee selection rectangle */}
          {marqueeRect && marqueeRect.w > 0 && marqueeRect.h > 0 && (
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.w}
              height={marqueeRect.h}
              fill="rgba(120,130,255,0.08)"
              stroke="rgba(120,130,255,0.5)"
              strokeWidth={1 / camera.z}
              dash={[6 / camera.z, 3 / camera.z]}
              listening={false}
            />
          )}

          {/* Hovered frame highlight during drag */}
          {hoveredFrameId && (() => {
            const frame = engine.getShape(hoveredFrameId)
            if (!frame) return null
            const fp = frame.props as CanvasFrameProps
            return (
              <Rect
                x={frame.x}
                y={frame.y}
                width={fp.w}
                height={fp.h}
                stroke="#7882ff"
                strokeWidth={2 / camera.z}
                fill="rgba(120,130,255,0.05)"
                dash={[8 / camera.z, 4 / camera.z]}
                listening={false}
              />
            )
          })()}

          {/* Transformer */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            borderStroke="#7882ff"
            borderStrokeWidth={1.5}
            anchorStroke="#7882ff"
            anchorFill="#1a1a2e"
            anchorSize={8}
            anchorCornerRadius={2}
            onTransformEnd={handleTransformEnd}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) return oldBox
              return newBox
            }}
          />
        </Layer>
      </Stage>
    </div>
  )
}
