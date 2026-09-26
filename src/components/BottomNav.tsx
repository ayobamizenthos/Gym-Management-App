'use client'

import { useRef, useState } from 'react'
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
      className="group relative flex h-full flex-1 flex-col items-center justify-center gap-1 px-0.5"
    >
      <span className="relative">
        <item.icon
          size={21}
          strokeWidth={active ? 2.3 : 1.8}
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
          'max-w-full truncate text-[11px] font-semibold leading-none transition-colors',
          active ? 'text-live' : 'text-mute group-hover:text-chalk'
        )}
      >
        {item.label}
      </span>
      <span
        aria-hidden
        className={cn('h-1 w-1 rounded-full transition-colors', active ? 'bg-live' : 'bg-transparent')}
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

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center px-3.5 pb-[max(var(--nav-gap),env(safe-area-inset-bottom))]">
        {hint && (
          <span className="pointer-events-none absolute bottom-full mb-2 animate-rise whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-live">
            {swipe?.left === hint ? '← ' : ''}{hint.label}{swipe?.right === hint ? ' →' : ''}
          </span>
        )}

        <span className="pointer-events-none relative flex w-full max-w-md justify-center">
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
            className="pointer-events-auto relative flex h-[var(--nav-height)] w-full max-w-md items-stretch rounded-full bg-base-panel shadow-[0_10px_30px_-8px_rgba(0,0,0,.75)] will-change-transform"
          >
            <Slot item={left[0]} active={isOn(left[0])} unread={unread} dragged={dragged} />
            <Slot item={left[1]} active={isOn(left[1])} unread={unread} dragged={dragged} />

            {/* the raised action keeps its own column so the four tabs stay evenly spaced */}
            <div className="relative w-[74px] shrink-0">
              <Link
                href={action.href}
                aria-label={action.label}
                onClick={event => ignoreSwipeRelease(dragged, event)}
                className="absolute left-1/2 top-0 grid h-[58px] w-[58px] -translate-x-1/2 -translate-y-[19px] place-items-center rounded-full border-[5px] border-base bg-live text-ink shadow-[0_8px_20px_-4px_rgba(53,208,127,.45)] transition-transform active:scale-95"
              >
                <action.icon size={24} strokeWidth={2.2} aria-hidden />
              </Link>
              <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-semibold leading-none text-mute">
                {action.label}
              </span>
            </div>

            <Slot item={right[0]} active={isOn(right[0])} unread={unread} dragged={dragged} />
            <Slot item={right[1]} active={isOn(right[1])} unread={unread} dragged={dragged} />
          </nav>
        </span>
      </div>
    </>
  )
}
