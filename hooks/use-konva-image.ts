"use client"

import { useState, useEffect } from "react"

export function useKonvaImage(src: string | undefined | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }

    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = src

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])

  return image
}
