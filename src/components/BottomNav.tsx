'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

interface Props {
  label: string
  /** Exactly two on each side of the raised action. */
  left: [NavItem, NavItem]
  right: [NavItem, NavItem]
  action: { href: string; label: string; icon: LucideIcon }
}

/**
 * A floating pill rather than a full-width bar: it reads as a control that sits
 * on the app instead of a strip welded to the bottom of the phone, and the
 * raised centre gives the one action people come back for its own target.
 *
 * The ring around that button is painted in the page colour, which cuts the
 * button out of the pill instead of stacking a circle on top of it.
 */
export function BottomNav({ label, left, right, action }: Props) {
  const path = usePathname()
  const { unread } = useAlerts()

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
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
    >
      <nav
        aria-label={label}
        className="pointer-events-auto relative flex h-[62px] w-full max-w-md items-stretch rounded-full border border-edge-soft bg-base-panel shadow-[0_10px_30px_-8px_rgba(0,0,0,.75)]"
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
  )
}
