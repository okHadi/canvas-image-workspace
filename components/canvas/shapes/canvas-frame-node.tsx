"use client"

import React from "react"
import { Group, Rect, Text } from "react-konva"
import type { CanvasShape, CanvasFrameProps } from "@/lib/canvas-engine/types"

interface Props {
  shape: CanvasShape
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  isDraggable: boolean
}

export function CanvasFrameNode({ shape, isSelected, onSelect, onDragEnd, isDraggable }: Props) {
  const props = shape.props as CanvasFrameProps

  return (
    <Group
      id={shape.id}
      x={shape.x}
      y={shape.y}
      draggable={isDraggable}
      onClick={() => onSelect(shape.id)}
      onTap={() => onSelect(shape.id)}
      onDragEnd={(e) => onDragEnd(shape.id, e.target.x(), e.target.y())}
    >
      {/* Dashed border frame */}
      <Rect
        width={props.w}
        height={props.h}
        stroke="rgba(120, 130, 255, 0.5)"
        strokeWidth={2}
        dash={[8, 4]}
        cornerRadius={10}
        fill="rgba(120, 130, 255, 0.03)"
      />
      {/* Label above frame */}
      <Text
        x={8}
        y={-20}
        text={props.label}
        fontSize={12}
        fontFamily="system-ui, sans-serif"
        fontStyle="bold"
        fill="#7882ff"
      />
      {/* Placeholder text */}
      <Text
        x={0}
        y={props.h / 2 - 8}
        width={props.w}
        align="center"
        text="Drop elements here"
        fontSize={14}
        fontFamily="system-ui, sans-serif"
        fill="rgba(120, 130, 255, 0.3)"
      />
    </Group>
  )
}
