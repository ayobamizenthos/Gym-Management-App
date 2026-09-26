'use client'

import { useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useAlerts } from '@/stores/alerts'
import { badgeCount } from '@/lib/notifications'
import { cn } from '@/lib/cn'

interface Props {
  /** The inbox this bell opens. */
  href: string
  /** Where to land on closing when the inbox was not opened from this bell. */
  home: string
}

/** Opens the inbox, and closes it again when tapped while the inbox is showing. */
export function AlertBell({ href, home }: Props) {
  const { unread } = useAlerts()
  const router = useRouter()
  const path = usePathname()
  const openedHere = useRef(false)
  const open = path === href

  const toggle = () => {
    if (!open) {
      openedHere.current = true
      router.push(href)
      return
    }
    // the chrome outlives navigation, so this knows whether back stays in the app
    if (openedHere.current) router.back()
    else router.replace(home)
    openedHere.current = false
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-current={open ? 'page' : undefined}
      aria-label={open ? 'Close alerts' : unread > 0 ? unread + ' unread alerts' : 'Alerts'}
      className={cn(
        'relative -mr-2.5 grid h-11 w-11 place-items-center transition-colors',
        open ? 'text-live' : 'text-mute hover:text-chalk'
      )}
    >
      <Bell size={19} strokeWidth={open ? 2.4 : 2} aria-hidden />
      {unread > 0 && !open && (
        <span
          aria-hidden
          className="absolute right-1.5 top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-out-deep px-1 text-[10px] font-bold leading-none text-white"
        >
          {badgeCount(unread)}
        </span>
      )}
    </button>
  )
}
