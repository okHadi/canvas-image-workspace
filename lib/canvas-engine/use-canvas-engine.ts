"use client"

import { useContext, useSyncExternalStore, useCallback } from "react"
import { CanvasEngineContext } from "./canvas-engine-context"
import type { CanvasEngine } from "./types"

export function useCanvasEngine(): CanvasEngine {
  const engine = useContext(CanvasEngineContext)
  if (!engine) {
    throw new Error("useCanvasEngine must be used within a CanvasEngineProvider")
  }
  return engine
}

/**
 * Reactive hook that re-renders when the canvas engine state changes.
 */
export function useCanvasValue<T>(
  _name: string,
  selector: (engine: CanvasEngine) => T,
  deps: any[] = []
): T {
  const engine = useCanvasEngine()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getSnapshot = useCallback(() => selector(engine), [engine, ...deps])

  return useSyncExternalStore(engine.subscribe, getSnapshot, getSnapshot)
}
