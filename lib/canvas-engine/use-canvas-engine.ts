"use client"

import { useContext, useSyncExternalStore, useCallback, useRef } from "react"
import { CanvasEngineContext } from "./canvas-engine-context"
import type { CanvasEngine } from "./types"

export function useCanvasEngine(): CanvasEngine {
  const engine = useContext(CanvasEngineContext)
  if (!engine) {
    throw new Error("useCanvasEngine must be used within a CanvasEngineProvider")
  }
  return engine
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false
    }
    return true
  }

  const keysA = Object.keys(a as Record<string, unknown>)
  const keysB = Object.keys(b as Record<string, unknown>)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.is((a as any)[key], (b as any)[key])) return false
  }
  return true
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
  const cachedRef = useRef<{ initialized: boolean; value: T }>({ initialized: false, value: undefined as T })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getSnapshot = useCallback(() => {
    const next = selector(engine)
    if (cachedRef.current.initialized && shallowEqual(cachedRef.current.value, next)) {
      return cachedRef.current.value
    }
    cachedRef.current = { initialized: true, value: next }
    return next
  }, [engine, ...deps])

  return useSyncExternalStore(engine.subscribe, getSnapshot, getSnapshot)
}
