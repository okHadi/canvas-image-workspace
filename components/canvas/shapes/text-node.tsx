"use client"

import React, { useState, useRef, useEffect } from "react"
import { Group, Text, Rect } from "react-konva"
import { Html } from "react-konva-utils"
import type { CanvasShape, TextProps } from "@/lib/canvas-engine/types"

interface Props {
  shape: CanvasShape
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTextChange: (id: string, text: string) => void
  isDraggable: boolean
}

export function TextNode({ shape, isSelected, onSelect, onDragEnd, onTextChange, isDraggable }: Props) {
  const props = shape.props as TextProps
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(props.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditText(props.text)
  }, [props.text])

  const handleDblClick = () => {
    setIsEditing(true)
    setEditText(props.text)
  }

  const commitEdit = () => {
    setIsEditing(false)
    if (editText !== props.text) {
      onTextChange(shape.id, editText)
    }
  }

  if (isEditing) {
    return (
      <Group id={shape.id} x={shape.x} y={shape.y}>
        <Html>
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault()
                commitEdit()
              }
            }}
            style={{
              width: Math.max(props.w, 200),
              minHeight: 30,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(120,130,255,0.5)",
              borderRadius: 4,
              color: props.color,
              fontSize: props.fontSize,
              fontFamily: "system-ui, sans-serif",
              padding: "4px 6px",
              outline: "none",
              resize: "both",
            }}
          />
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
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragEnd={(e) => onDragEnd(shape.id, e.target.x(), e.target.y())}
    >
      <Text
        text={props.text}
        fontSize={props.fontSize}
        fill={props.color}
        fontFamily="system-ui, sans-serif"
      />
    </Group>
  )
}
