"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { Stage, Layer, Circle, Transformer, Rect } from "react-konva"
import { useCanvasEngine, useCanvasValue } from "@/lib/canvas-engine"
import { ShapeRenderer } from "./shapes/shape-renderer"
import type { CanvasShape, DrawProps } from "@/lib/canvas-engine/types"
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

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

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
    },
    [engine, camera]
  )

  // Click on empty area to deselect
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current || e.target.getClassName() === "Rect" && e.target.id() === "background") {
        engine.deselectAll()
      }
    },
    [engine]
  )

  // Shape selection
  const handleShapeSelect = useCallback(
    (id: string) => {
      if (currentTool === "select") {
        engine.selectShape(id)
      }
    },
    [engine, currentTool]
  )

  // Shape drag end
  const handleShapeDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      engine.updateShape({ id, x, y })
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

  // Draw tool handlers
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (currentTool !== "draw") return
      const stage = stageRef.current
      if (!stage) return

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
      if (currentTool !== "draw" || !drawingShapeIdRef.current) return
      const stage = stageRef.current
      if (!stage) return

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
