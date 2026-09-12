'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { useAlerts } from '@/stores/alerts'
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
  /**
   * Dragging across the bar switches workspace. Staff run the gym and train in
   * it, and this is how they cross between the two without hunting for a link.
   */
  swipe?: { left?: Destination; right?: Destination }
}

const THRESHOLD = 64

export function BottomNav({ label, left, right, action, swipe }: Props) {
  const path = usePathname()
  const router = useRouter()
  const { unread } = useAlerts()

  const from = useRef<{ x: number; y: number } | null>(null)
  // The drag is written straight to the node's transform, so the finger is
  // never waiting on a React render. Only the label under it is state.
  const bar = useRef<HTMLElement>(null)
  const [hint, setHint] = useState<{ side: 'left' | 'right'; label: string } | null>(null)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)

  const targetFor = (dx: number) => (dx < 0 ? swipe?.left : swipe?.right)

  const settle = () => {
    const node = bar.current
    if (!node) return
    node.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1)'
    node.style.transform = ''
    window.setTimeout(() => { if (bar.current) bar.current.style.transition = '' }, 260)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (leaving) return
    const touch = e.touches[0]
    from.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const start = from.current
    const node = bar.current
    if (!start || !node) return
    const touch = e.touches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    // a vertical drag is a scroll, not a switch
    if (Math.abs(dy) > 44) {
      from.current = null
      node.style.transform = ''
      setHint(null)
      return
    }

    const target = targetFor(dx)
    if (!target) return

    // rubber band: the bar follows the finger but gives up ground as it goes,
    // so the gesture always feels like it is pulling against something
    const pull = Math.sign(dx) * Math.min(Math.abs(dx) * 0.42, 26)
    node.style.transform = 'translate3d(' + pull.toFixed(1) + 'px,0,0)'

    const armed = Math.abs(dx) >= THRESHOLD
    setHint(armed ? { side: dx < 0 ? 'left' : 'right', label: target.label } : null)
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

    if (!target || Math.abs(dx) < THRESHOLD || Math.abs(dy) > 44) {
      settle()
      return
    }

    // The workspace slides out the way the finger went and the next one arrives
    // behind it. One compositor-only animation: no layout, nothing to drop.
    setLeaving(dx < 0 ? 'left' : 'right')
    navigator.vibrate?.(12)
    settle()
    window.setTimeout(() => router.push(target.href), 170)
    window.setTimeout(() => setLeaving(null), 640)
  }

  const isOn = (item: NavItem) =>
    item.section ? path === item.section || path.startsWith(item.section + '/') : path === item.href

  const Slot = ({ item }: { item: NavItem }) => {
    const active = isOn(item)
    return (
      <Link
        href={item.href}
        replace
        aria-current={active ? 'page' : undefined}
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
              className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-out-deep px-1 text-[9px] font-bold leading-none text-white"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        <span
          className={cn(
            'max-w-full truncate text-[10px] font-semibold leading-none transition-colors',
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

  return (
    <>
      {leaving && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-base',
            leaving === 'left' ? 'animate-wipe-left' : 'animate-wipe-right'
          )}
        >
          <span className="animate-pop font-display text-3xl uppercase tracking-tightest text-chalk">
            Zenthos<span className="text-live">Gym</span>
          </span>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center px-3.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {hint && (
          <span className="mb-2 animate-rise rounded-full bg-base-raised px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-live shadow-lift">
            {hint.side === 'left' ? '← ' : ''}{hint.label}{hint.side === 'right' ? ' →' : ''}
          </span>
        )}

        <nav
          ref={bar}
          aria-label={label}
          onTouchStart={swipe ? onTouchStart : undefined}
          onTouchMove={swipe ? onTouchMove : undefined}
          onTouchEnd={swipe ? onTouchEnd : undefined}
          onTouchCancel={swipe ? () => { from.current = null; setHint(null); settle() } : undefined}
          className="pointer-events-auto relative flex h-[62px] w-full max-w-md items-stretch rounded-full bg-base-panel shadow-[0_10px_30px_-8px_rgba(0,0,0,.75)] will-change-transform"
        >
          <Slot item={left[0]} />
          <Slot item={left[1]} />

          {/* the raised action keeps its own column so the four tabs stay evenly spaced */}
          <div className="relative w-[74px] shrink-0">
            <Link
              href={action.href}
              aria-label={action.label}
              className="absolute left-1/2 top-0 grid h-[58px] w-[58px] -translate-x-1/2 -translate-y-[19px] place-items-center rounded-full border-[5px] border-base bg-live text-ink shadow-[0_8px_20px_-4px_rgba(53,208,127,.45)] transition-transform active:scale-95"
            >
              <action.icon size={24} strokeWidth={2.2} aria-hidden />
            </Link>
            <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] font-semibold leading-none text-mute">
              {action.label}
            </span>
          </div>

          <Slot item={right[0]} />
          <Slot item={right[1]} />
        </nav>
      </div>
    </>
  )
}
