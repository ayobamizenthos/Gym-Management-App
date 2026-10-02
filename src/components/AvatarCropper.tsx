'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useModal } from '@/hooks/useModal'

const OUTPUT = 512
const JPEG_QUALITY = 0.9
const MAX_ZOOM = 4
const FALLBACK_FRAME = 280
const UNREADABLE = 'This photo cannot be opened on this device. Choose a JPEG or PNG instead.'

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
  const [problem, setProblem] = useState<string | null>(null)

  const panel = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    const img = new window.Image()
    img.onload = () => setImage(img)
    // HEIC and some RAW files arrive from Android galleries but the browser cannot decode them
    img.onerror = () => setProblem(UNREADABLE)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Clamp so the photo can never be dragged away from the frame edges.
  const clamp = useCallback(
    (next: { x: number; y: number }, scale: number) => {
      const frame = frameRef.current?.clientWidth ?? FALLBACK_FRAME
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
      setZoom(Math.min(MAX_ZOOM, Math.max(1, pinch.current.zoom * ratio)))
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

  const apply = () => {
    if (!image) return
    const frame = frameRef.current?.clientWidth ?? FALLBACK_FRAME
    const base = Math.max(frame / image.width, frame / image.height)
    const scale = base * zoom

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setProblem(UNREADABLE)
      return
    }
    setBusy(true)

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
        else setProblem(UNREADABLE)
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  }

  useModal(panel, onCancel)

  // Portalled to the body: an animated ancestor would otherwise become the
  // containing block for this fixed layer and pin it under the bottom bar.
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="Adjust photo"
      className="fixed inset-0 z-[95] flex h-dvh flex-col bg-base pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
    >
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={onCancel} aria-label="Cancel" className="-ml-3 grid h-11 w-11 place-items-center text-white/70 hover:text-white">
          <X size={22} aria-hidden />
        </button>
        <p className="text-[15px] font-semibold text-white">Adjust photo</p>
        <span aria-hidden className="w-11" />
      </div>

      {problem && <p role="alert" className="px-8 text-center text-[15px] text-out">{problem}</p>}

      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endDrag}
          className="relative aspect-square w-full max-w-[min(300px,55dvh)] cursor-grab touch-none overflow-hidden rounded-full bg-black active:cursor-grabbing"
        >
          {src && image && (
            <Image
              src={src}
              alt=""
              width={image.width}
              height={image.height}
              unoptimized
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none origin-center"
              style={{
                transform: 'translate(-50%, -50%) translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + zoom + ')',
                ...(image.width >= image.height ? { height: '100%', width: 'auto' } : { width: '100%', height: 'auto' }),
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
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-full accent-white"
        />
      </div>

      <div className="flex gap-3 px-5 pb-6 pt-2">
        <button onClick={onCancel} className="btn h-12 flex-1 border border-white/25 text-white">
          Cancel
        </button>
        <button onClick={apply} disabled={busy || !image || Boolean(problem)} className="btn h-12 flex-1 bg-chalk text-inverse">
          {busy ? 'Saving' : 'Use photo'}
        </button>
      </div>
    </div>,
    document.body
  )
}
