"use client"

import React from "react"
import { Group, Line } from "react-konva"
import type { CanvasShape, DrawProps } from "@/lib/canvas-engine/types"

interface Props {
  shape: CanvasShape
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  isDraggable: boolean
}

export function DrawNode({ shape, isSelected, onSelect, onDragEnd, isDraggable }: Props) {
  const props = shape.props as DrawProps

  if (props.points.length < 4) return null

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
      <Line
        points={props.points}
        stroke={props.color}
        strokeWidth={props.strokeWidth}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        globalCompositeOperation="source-over"
      />
    </Group>
  )
}
