'use client'

import { useEffect, useRef } from 'react'

const COLOURS = ['#35D07F', '#F6F6F3', '#FFB020', '#8BE3B4', '#35D07F']
const PIECES = 140
const LIFETIME_MS = 3200
const GRAVITY = 0.32
const DRAG = 0.985

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  spin: number
  angle: number
  colour: string
  ribbon: boolean
}

/** One burst from a point on screen, then the canvas removes itself. Skipped entirely for reduced motion. */
export function Confetti({ originX, originY, delayMs = 0 }: { originX: number; originY: number; delayMs?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const node = canvas.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const context = node.getContext('2d')
    if (!context) return

    // sized from the canvas itself: the window can report a different width on mobile while the page settles
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = node.clientWidth
    const height = node.clientHeight
    node.width = width * ratio
    node.height = height * ratio
    const wipe = () => {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, node.width, node.height)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const pieces: Piece[] = Array.from({ length: PIECES }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15
      const speed = 9 + Math.random() * 11
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        spin: (Math.random() - 0.5) * 0.4,
        angle: Math.random() * Math.PI,
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        ribbon: Math.random() > 0.55,
      }
    })

    let frame = 0
    let started = 0
    let previous = 0
    const draw = (time: number) => {
      if (!started) started = previous = time
      const age = time - started
      // steps are measured against a 60 Hz frame so a 120 Hz screen does not double the speed
      const step = Math.min(3, (time - previous) / (1000 / 60))
      previous = time
      const drag = Math.pow(DRAG, step)
      wipe()
      context.globalAlpha = Math.max(0, 1 - Math.max(0, age - LIFETIME_MS * 0.6) / (LIFETIME_MS * 0.4))
      for (const piece of pieces) {
        piece.vx *= drag
        piece.vy = piece.vy * drag + GRAVITY * step
        piece.x += piece.vx * step
        piece.y += piece.vy * step
        piece.angle += piece.spin * step
        context.save()
        context.translate(piece.x, piece.y)
        context.rotate(piece.angle)
        context.fillStyle = piece.colour
        // ribbons flutter by squashing as they turn
        if (piece.ribbon) context.fillRect(-piece.size, -piece.size * 0.22 * Math.abs(Math.cos(piece.angle * 3)), piece.size * 2, piece.size * 0.44)
        else context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size)
        context.restore()
      }
      if (age < LIFETIME_MS) frame = requestAnimationFrame(draw)
      else wipe()
    }

    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(draw)
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [originX, originY, delayMs])

  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[70] h-full w-full" />
}
