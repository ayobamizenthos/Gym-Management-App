'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { useAlerts } from '@/stores/alerts'
import { badgeCount } from '@/lib/notifications'
import { cn } from '@/lib/cn'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Marks this tab active for any route beneath it, not just an exact match. */
  section?: string
  /** Shows the unread count. */
  badge?: boolean
}

interface Destination {
  href: string
  label: string
}

interface Props {
  label: string
  /** Exactly two on each side of the raised action. */
  left: [NavItem, NavItem]
  right: [NavItem, NavItem]
  action: { href: string; label: string; icon: LucideIcon }
  /** Dragging across the bar switches to these workspaces. */
  swipe?: { left?: Destination; right?: Destination }
}

/** Past this, the drag is a switch rather than a tap that wandered. */
const THRESHOLD = 56
/** Past this, the finger is scrolling the page, not crossing the bar. */
const SLOP = 18
/** Movement that turns a touch into a drag, so the release is not also a tap. */
const DRAG_START = 8
/** The bar follows the finger at this fraction of the drag, up to MAX_PULL pixels. */
const PULL_RATIO = 0.4
const MAX_PULL = 24
const SETTLE_MS = 200
const SWITCH_DIM_MS = 260
const SWITCH_BUZZ_MS = 10

// The bar's shape: a full-width sheet with rounded top corners and a pit the raised action sits in.
const BAR_HEIGHT = 80
const CORNER = 40
const BALL = 60
const PIT_RADIUS = 38
const PIT_CENTER_Y = 21
const SHOULDER = 72
const BALL_RISE = 10

function barPath(width: number): string {
  const mid = width / 2
  const h = BAR_HEIGHT + 40
  return [
    `M0 ${CORNER}`,
    `Q0 0 ${CORNER} 0`,
    `L${mid - SHOULDER} 0`,
    `C${mid - SHOULDER + 22} 0 ${mid - PIT_RADIUS - 1} 8 ${mid - PIT_RADIUS} ${PIT_CENTER_Y}`,
    `A${PIT_RADIUS} ${PIT_RADIUS} 0 0 0 ${mid + PIT_RADIUS} ${PIT_CENTER_Y}`,
    `C${mid + PIT_RADIUS + 1} 8 ${mid + SHOULDER - 22} 0 ${mid + SHOULDER} 0`,
    `L${width - CORNER} 0`,
    `Q${width} 0 ${width} ${CORNER}`,
    `L${width} ${h}`,
    `L0 ${h}`,
    'Z',
  ].join(' ')
}

/** The release of a swipe is not a tap on whatever it ended over. */
function ignoreSwipeRelease(dragged: React.MutableRefObject<boolean>, event: React.MouseEvent) {
  if (!dragged.current) return
  event.preventDefault()
  dragged.current = false
}

function Slot({
  item,
  active,
  unread,
  dragged,
}: {
  item: NavItem
  active: boolean
  unread: number
  dragged: React.MutableRefObject<boolean>
}) {
  return (
    <Link
      href={item.href}
      replace
      aria-current={active ? 'page' : undefined}
      onClick={event => ignoreSwipeRelease(dragged, event)}
      className="group relative flex h-full flex-1 flex-col items-center px-0.5 pt-4"
    >
      <span className="relative">
        <item.icon
          size={26}
          strokeWidth={active ? 2.2 : 1.6}
          aria-hidden
          className={cn('transition-colors', active ? 'text-live' : 'text-mute group-hover:text-chalk')}
        />
        {item.badge && unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-out-deep px-1 text-[10px] font-bold leading-none text-white"
          >
            {badgeCount(unread)}
          </span>
        )}
      </span>
      <span
        className={cn(
          'mt-1.5 max-w-full truncate text-[12px] font-medium leading-none transition-colors',
          active ? 'text-live' : 'text-mute group-hover:text-chalk'
        )}
      >
        {item.label}
      </span>
      <span
        aria-hidden
        className={cn('mt-1.5 h-[5px] w-[5px] rounded-full transition-colors', active ? 'bg-live' : 'bg-transparent')}
      />
      {item.badge && unread > 0 && <span className="sr-only">{unread} unread</span>}
    </Link>
  )
}

export function BottomNav({ label, left, right, action, swipe }: Props) {
  const path = usePathname()
  const router = useRouter()
  const { unread } = useAlerts()

  const bar = useRef<HTMLElement>(null)
  const from = useRef<{ x: number; y: number } | null>(null)
  const dragged = useRef(false)
  const [hint, setHint] = useState<Destination | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [width, setWidth] = useState(0)
  const shape = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = shape.current
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const targetFor = (dx: number) => (dx < 0 ? swipe?.left : swipe?.right)

  const settle = () => {
    const node = bar.current
    if (!node) return
    node.style.transition = 'transform ' + SETTLE_MS + 'ms cubic-bezier(.2,.8,.2,1)'
    node.style.transform = ''
    window.setTimeout(() => { if (bar.current) bar.current.style.transition = '' }, SETTLE_MS)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (leaving) return
    const touch = e.touches[0]
    from.current = { x: touch.clientX, y: touch.clientY }
    dragged.current = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const start = from.current
    const node = bar.current
    if (!start || !node) return
    const touch = e.touches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) {
      from.current = null
      node.style.transform = ''
      setHint(null)
      return
    }

    const target = targetFor(dx)
    if (!target) return
    if (Math.abs(dx) > DRAG_START) dragged.current = true

    const pull = Math.sign(dx) * Math.min(Math.abs(dx) * PULL_RATIO, MAX_PULL)
    node.style.transform = 'translate3d(' + pull.toFixed(1) + 'px,0,0)'
    setHint(Math.abs(dx) >= THRESHOLD ? target : null)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = from.current
    from.current = null
    setHint(null)
    if (!start) return

    const touch = e.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    const target = targetFor(dx)

    settle()
    if (!target || Math.abs(dx) < THRESHOLD || Math.abs(dy) > SLOP * 2) return

    navigator.vibrate?.(SWITCH_BUZZ_MS)
    setLeaving(true)
    router.push(target.href)
    window.setTimeout(() => setLeaving(false), SWITCH_DIM_MS)
  }

  const isOn = (item: NavItem) =>
    item.section ? path === item.section || path.startsWith(item.section + '/') : path === item.href

  return (
    <>
      {/* dims the screen while the next workspace mounts */}
      {leaving && <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] animate-cross bg-base" />}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="relative mx-auto max-w-2xl">
          {hint && (
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 animate-rise whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-live">
              {swipe?.left === hint ? '← ' : ''}{hint.label}{swipe?.right === hint ? ' →' : ''}
            </span>
          )}

          <nav
            ref={bar}
            aria-label={label}
            onTouchStart={swipe ? onTouchStart : undefined}
            onTouchMove={swipe ? onTouchMove : undefined}
            onTouchEnd={swipe ? onTouchEnd : undefined}
            onTouchCancel={swipe ? () => { from.current = null; setHint(null); settle() } : undefined}
            // without this the browser claims the horizontal drag for its own
            // back gesture and the swipe never reaches us
            style={swipe ? { touchAction: 'pan-y' } : undefined}
            className="pointer-events-auto relative will-change-transform"
          >
            <div ref={shape} aria-hidden className="absolute inset-x-0 top-0 h-full drop-shadow-[0_-6px_18px_rgba(0,0,0,.18)]">
              {width === 0 && <div className="h-full rounded-t-[40px] bg-base-panel" />}
              {width > 0 && (
                <svg width={width} height="100%" className="block h-full" preserveAspectRatio="none">
                  <path d={barPath(width)} fill="rgb(var(--base-panel))" />
                </svg>
              )}
            </div>

            <div
              className="relative grid grid-cols-5 items-start pb-[env(safe-area-inset-bottom)]"
              style={{ height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom))` }}
            >
              <Slot item={left[0]} active={isOn(left[0])} unread={unread} dragged={dragged} />
              <Slot item={left[1]} active={isOn(left[1])} unread={unread} dragged={dragged} />

              <div className="relative flex justify-center">
                <Link
                  href={action.href}
                  aria-label={action.label}
                  onClick={event => ignoreSwipeRelease(dragged, event)}
                  style={{ width: BALL, height: BALL, marginTop: -BALL_RISE }}
                  className="relative grid place-items-center rounded-full bg-gradient-to-b from-[#4BE08F] to-[#27B86A] text-ink shadow-[0_10px_22px_-6px_rgba(53,208,127,.6)] transition-transform active:scale-95"
                >
                  <action.icon size={26} strokeWidth={2.2} aria-hidden />
                </Link>
              </div>

              <Slot item={right[0]} active={isOn(right[0])} unread={unread} dragged={dragged} />
              <Slot item={right[1]} active={isOn(right[1])} unread={unread} dragged={dragged} />
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
