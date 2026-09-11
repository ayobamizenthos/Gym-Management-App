'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const OUTPUT = 512

interface Props {
  file: File
  onCancel: () => void
  onDone: (blob: Blob) => void
}

/**
 * Square avatar cropper. The photo can be dragged and zoomed inside the frame
 * before anything is uploaded, so a portrait shot does not get centre-cropped
 * through someone's forehead.
 */
export function AvatarCropper({ file, onCancel, onDone }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)

  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Clamp so the photo can never be dragged away from the frame edges.
  const clamp = useCallback(
    (next: { x: number; y: number }, scale: number) => {
      const frame = frameRef.current?.clientWidth ?? 280
      if (!image) return next
      const base = Math.max(frame / image.width, frame / image.height)
      const w = image.width * base * scale
      const h = image.height * base * scale
      const maxX = Math.max(0, (w - frame) / 2)
      const maxY = Math.max(0, (h - frame) / 2)
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      }
    },
    [image]
  )

  useEffect(() => {
    setOffset(current => clamp(current, zoom))
  }, [zoom, clamp])

  const distanceBetween = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      pinch.current = { distance: distanceBetween(event.touches), zoom }
      drag.current = null
    } else {
      const touch = event.touches[0]
      drag.current = { x: touch.clientX, y: touch.clientY, ox: offset.x, oy: offset.y }
    }
  }

  const onTouchMove = (event: React.TouchEvent) => {
    if (pinch.current && event.touches.length === 2) {
      const ratio = distanceBetween(event.touches) / pinch.current.distance
      setZoom(Math.min(4, Math.max(1, pinch.current.zoom * ratio)))
      return
    }
    if (drag.current && event.touches.length === 1) {
      const touch = event.touches[0]
      setOffset(
        clamp(
          { x: drag.current.ox + (touch.clientX - drag.current.x), y: drag.current.oy + (touch.clientY - drag.current.y) },
          zoom
        )
      )
    }
  }

  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return
    setOffset(
      clamp(
        { x: drag.current.ox + (event.clientX - drag.current.x), y: drag.current.oy + (event.clientY - drag.current.y) },
        zoom
      )
    )
  }

  const endDrag = () => {
    drag.current = null
    pinch.current = null
  }

  const apply = async () => {
    if (!image) return
    setBusy(true)
    const frame = frameRef.current?.clientWidth ?? 280
    const base = Math.max(frame / image.width, frame / image.height)
    const scale = base * zoom

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = OUTPUT / frame
    const drawW = image.width * scale * ratio
    const drawH = image.height * scale * ratio
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      image,
      (OUTPUT - drawW) / 2 + offset.x * ratio,
      (OUTPUT - drawH) / 2 + offset.y * ratio,
      drawW,
      drawH
    )

    canvas.toBlob(
      blob => {
        setBusy(false)
        if (blob) onDone(blob)
      },
      'image/jpeg',
      0.9
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Adjust photo" className="fixed inset-0 z-[95] flex flex-col bg-base">
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={onCancel} aria-label="Cancel" className="text-white/70 hover:text-white">
          <X size={22} />
        </button>
        <p className="text-[15px] font-semibold text-white">Adjust photo</p>
        <span className="w-6" />
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endDrag}
          className="relative aspect-square w-full max-w-[300px] cursor-grab touch-none overflow-hidden rounded-full bg-black active:cursor-grabbing"
        >
          {src && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                transform: 'translate(-50%, -50%) translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + zoom + ')',
                left: '50%',
                top: '50%',
                position: 'absolute',
                minWidth: '100%',
                minHeight: '100%',
                objectFit: 'cover',
                transformOrigin: 'center',
              }}
            />
          )}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70" />
        </div>
      </div>

      <div className="px-8 pb-2">
        <label htmlFor="zoom" className="sr-only">
          Zoom
        </label>
        <input
          id="zoom"
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-full accent-white"
        />
      </div>

      <div className="flex gap-3 px-5 pb-8 pt-2">
        <button onClick={onCancel} className="btn h-12 flex-1 border border-white/25 text-white">
          Cancel
        </button>
        <button onClick={apply} disabled={busy || !image} className="btn h-12 flex-1 bg-chalk text-base">
          {busy ? 'Saving' : 'Use photo'}
        </button>
      </div>
    </div>
  )
}
