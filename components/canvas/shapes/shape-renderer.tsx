"use client"

import React from "react"
import { GeneratedImageNode } from "./generated-image-node"
import { CanvasFrameNode } from "./canvas-frame-node"
import { TextNode } from "./text-node"
import { DrawNode } from "./draw-node"
import type { CanvasShape } from "@/lib/canvas-engine/types"

interface Props {
  shape: CanvasShape
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTextChange: (id: string, text: string) => void
  isDraggable: boolean
}

export function ShapeRenderer({ shape, isSelected, onSelect, onDragEnd, onTextChange, isDraggable }: Props) {
  switch (shape.type) {
    case "generated-image":
      return (
        <GeneratedImageNode
          shape={shape}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          isDraggable={isDraggable}
        />
      )
    case "canvas-frame":
      return (
        <CanvasFrameNode
          shape={shape}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          isDraggable={isDraggable}
        />
      )
    case "text":
      return (
        <TextNode
          shape={shape}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTextChange={onTextChange}
          isDraggable={isDraggable}
        />
      )
    case "draw":
      return (
        <DrawNode
          shape={shape}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          isDraggable={isDraggable}
        />
      )
    default:
      return null
  }
}
