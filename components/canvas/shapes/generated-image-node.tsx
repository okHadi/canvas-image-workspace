"use client"

import React from "react"
import { Group, Rect, Image as KonvaImage } from "react-konva"
import { Html } from "react-konva-utils"
import { useKonvaImage } from "@/hooks/use-konva-image"
import type { CanvasShape, GeneratedImageProps } from "@/lib/canvas-engine/types"

interface Props {
  shape: CanvasShape
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  isDraggable: boolean
}

export function GeneratedImageNode({ shape, isSelected, onSelect, onDragEnd, isDraggable }: Props) {
  const props = shape.props as GeneratedImageProps
  const image = useKonvaImage(props.imageUrl || null)

  if (props.isLoading) {
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
        <Rect
          width={props.w}
          height={props.h}
          fill="#1a1a2e"
          cornerRadius={8}
        />
        <Html
          groupProps={{ x: 0, y: 0 }}
          divProps={{ style: { pointerEvents: "none" } }}
        >
          <div
            style={{
              width: props.w,
              height: props.h,
              background: "linear-gradient(110deg, #1a1a2e 8%, #25254a 18%, #1a1a2e 33%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s linear infinite",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                color: "#8888aa",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                textAlign: "center",
                padding: 16,
              }}
            >
              Generating...
            </div>
          </div>
        </Html>
      </Group>
    )
  }

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
      {image ? (
        <KonvaImage
          image={image}
          width={props.w}
          height={props.h}
          cornerRadius={8}
        />
      ) : (
        <Rect
          width={props.w}
          height={props.h}
          fill="#1a1a2e"
          cornerRadius={8}
          stroke="rgba(120,130,255,0.2)"
          strokeWidth={1}
        />
      )}
      <Html
        groupProps={{ x: 0, y: props.h - 40 }}
        divProps={{ style: { pointerEvents: "none" } }}
      >
        <div
          style={{
            width: props.w,
            height: 40,
            background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
            padding: "8px 10px",
            display: "flex",
            gap: 6,
            alignItems: "flex-end",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "#ffffffcc",
              background: "rgba(255,255,255,0.15)",
              padding: "2px 6px",
              borderRadius: 4,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {props.style}
          </span>
          {props.prompt && (
            <span
              style={{
                fontSize: 10,
                color: "#ffffff99",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 200,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {props.prompt}
            </span>
          )}
        </div>
      </Html>
    </Group>
  )
}
