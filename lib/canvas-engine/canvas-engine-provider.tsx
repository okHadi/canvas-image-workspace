"use client"

import React, { useCallback, useMemo, useRef, useEffect } from "react"
import { CanvasEngineContext } from "./canvas-engine-context"
import { useAppStore } from "@/lib/store"
import type { CanvasEngine, CanvasShape, CameraState, Point, Bounds, ToolId, ShapeType, ShapeProps } from "./types"

function generateId(): string {
  return "shape:" + Math.random().toString(36).slice(2, 11)
}

export function CanvasEngineProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<() => void>>(new Set())
  const stageContainerRef = useRef<HTMLDivElement | null>(null)
  const versionRef = useRef(0)
  const shapesCacheRef = useRef<{ version: number; value: CanvasShape[] }>({ version: -1, value: [] })
  const selectedIdsCacheRef = useRef<{ version: number; value: string[] }>({ version: -1, value: [] })
  const cameraCacheRef = useRef<{ version: number; value: CameraState }>({ version: -1, value: { x: 0, y: 0, z: 1 } })

  const notify = useCallback(() => {
    versionRef.current++
    listenersRef.current.forEach((cb) => cb())
  }, [])

  const store = useAppStore

  const engine: CanvasEngine = useMemo(() => {
    const eng: CanvasEngine = {
      createShape(partial) {
        const state = store.getState()
        const id = partial.id || generateId()
        const shape: CanvasShape = {
          id,
          type: partial.type,
          x: partial.x ?? 0,
          y: partial.y ?? 0,
          props: partial.props ?? getDefaultProps(partial.type),
        }
        state.addShape(shape)
        notify()
        return shape
      },

      createShapes(partials) {
        const shapes: CanvasShape[] = []
        const state = store.getState()
        for (const partial of partials) {
          const id = partial.id || generateId()
          const shape: CanvasShape = {
            id,
            type: partial.type,
            x: partial.x ?? 0,
            y: partial.y ?? 0,
            props: partial.props ?? getDefaultProps(partial.type),
          }
          state.addShape(shape)
          shapes.push(shape)
        }
        notify()
        return shapes
      },

      updateShape(partial) {
        const state = store.getState()
        const existing = state.shapes.get(partial.id)
        if (!existing) return
        const updated: CanvasShape = {
          ...existing,
          ...(partial.x !== undefined ? { x: partial.x } : {}),
          ...(partial.y !== undefined ? { y: partial.y } : {}),
          ...(partial.type !== undefined ? { type: partial.type } : {}),
          props: partial.props ? { ...existing.props, ...partial.props } : existing.props,
        }
        state.updateShapeInStore(updated)
        notify()
      },

      deleteShape(id) {
        const state = store.getState()
        state.removeShape(id)
        // Also deselect if selected
        const selectedIds = state.selectedShapeIds
        if (selectedIds.has(id)) {
          state.setSelectedShapeIds(new Set([...selectedIds].filter((sid) => sid !== id)))
        }
        notify()
      },

      getShape(id) {
        return store.getState().shapes.get(id)
      },

      getAllShapes() {
        const v = versionRef.current
        if (shapesCacheRef.current.version !== v) {
          shapesCacheRef.current = { version: v, value: Array.from(store.getState().shapes.values()) }
        }
        return shapesCacheRef.current.value
      },

      getSelectedShapeIds() {
        const v = versionRef.current
        if (selectedIdsCacheRef.current.version !== v) {
          selectedIdsCacheRef.current = { version: v, value: Array.from(store.getState().selectedShapeIds) }
        }
        return selectedIdsCacheRef.current.value
      },

      selectShape(id) {
        store.getState().setSelectedShapeIds(new Set([id]))
        notify()
      },

      deselectAll() {
        store.getState().setSelectedShapeIds(new Set())
        notify()
      },

      setCurrentTool(tool: ToolId) {
        store.getState().setCurrentTool(tool)
        notify()
      },

      getCurrentToolId() {
        return store.getState().currentTool
      },

      getCamera() {
        const v = versionRef.current
        if (cameraCacheRef.current.version !== v) {
          cameraCacheRef.current = { version: v, value: store.getState().camera }
        }
        return cameraCacheRef.current.value
      },

      setCamera(camera) {
        const state = store.getState()
        state.setCamera({ ...state.camera, ...camera })
        notify()
      },

      zoomIn(center?: Point) {
        const state = store.getState()
        const cam = state.camera
        const newZ = Math.min(cam.z * 1.25, 8)
        if (center) {
          const factor = newZ / cam.z
          state.setCamera({
            x: center.x - (center.x - cam.x) * factor,
            y: center.y - (center.y - cam.y) * factor,
            z: newZ,
          })
        } else {
          state.setCamera({ ...cam, z: newZ })
        }
        notify()
      },

      zoomOut(center?: Point) {
        const state = store.getState()
        const cam = state.camera
        const newZ = Math.max(cam.z / 1.25, 0.1)
        if (center) {
          const factor = newZ / cam.z
          state.setCamera({
            x: center.x - (center.x - cam.x) * factor,
            y: center.y - (center.y - cam.y) * factor,
            z: newZ,
          })
        } else {
          state.setCamera({ ...cam, z: newZ })
        }
        notify()
      },

      zoomToFit() {
        const shapes = Array.from(store.getState().shapes.values())
        if (shapes.length === 0) return

        const stageSize = eng.getStageSize()
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        for (const shape of shapes) {
          const props = shape.props as any
          const w = props.w || 100
          const h = props.h || 40
          minX = Math.min(minX, shape.x)
          minY = Math.min(minY, shape.y)
          maxX = Math.max(maxX, shape.x + w)
          maxY = Math.max(maxY, shape.y + h)
        }

        const contentW = maxX - minX
        const contentH = maxY - minY
        const padding = 80

        const scaleX = (stageSize.width - padding * 2) / contentW
        const scaleY = (stageSize.height - padding * 2) / contentH
        const z = Math.min(scaleX, scaleY, 2)

        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2

        store.getState().setCamera({
          x: stageSize.width / 2 - centerX * z,
          y: stageSize.height / 2 - centerY * z,
          z,
        })
        notify()
      },

      getViewportScreenCenter() {
        const size = eng.getStageSize()
        return { x: size.width / 2, y: size.height / 2 }
      },

      screenToPage(screenPoint: Point): Point {
        const cam = store.getState().camera
        return {
          x: (screenPoint.x - cam.x) / cam.z,
          y: (screenPoint.y - cam.y) / cam.z,
        }
      },

      pageToScreen(pagePoint: Point): Point {
        const cam = store.getState().camera
        return {
          x: pagePoint.x * cam.z + cam.x,
          y: pagePoint.y * cam.z + cam.y,
        }
      },

      getShapePageBounds(id: string): Bounds | null {
        const shape = store.getState().shapes.get(id)
        if (!shape) return null
        const props = shape.props as any
        return {
          x: shape.x,
          y: shape.y,
          w: props.w || 100,
          h: props.h || 40,
        }
      },

      subscribe(callback: () => void) {
        listenersRef.current.add(callback)
        return () => {
          listenersRef.current.delete(callback)
        }
      },

      getStageSize() {
        return {
          width: typeof window !== "undefined" ? window.innerWidth : 1280,
          height: typeof window !== "undefined" ? window.innerHeight : 720,
        }
      },
    }

    return eng
  }, [store, notify])

  return (
    <CanvasEngineContext.Provider value={engine}>
      {children}
    </CanvasEngineContext.Provider>
  )
}

function getDefaultProps(type: ShapeType): ShapeProps {
  switch (type) {
    case "generated-image":
      return {
        w: 512,
        h: 512,
        imageUrl: "",
        prompt: "",
        style: "Realistic",
        model: "Standard",
        aspectRatio: "1:1",
        seed: 1,
        isLoading: true,
      }
    case "canvas-frame":
      return {
        w: 512,
        h: 512,
        label: "Frame",
      }
    case "text":
      return {
        text: "Double click to edit",
        fontSize: 18,
        color: "#ffffff",
        w: 200,
        h: 40,
      }
    case "draw":
      return {
        points: [],
        color: "#ffffff",
        strokeWidth: 3,
        w: 0,
        h: 0,
      }
  }
}
