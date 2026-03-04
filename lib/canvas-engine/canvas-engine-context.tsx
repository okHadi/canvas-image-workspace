"use client"

import { createContext } from "react"
import type { CanvasEngine } from "./types"

export const CanvasEngineContext = createContext<CanvasEngine | null>(null)
