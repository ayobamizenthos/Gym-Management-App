'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useAlerts } from '@/stores/alerts'
import { cn } from '@/lib/cn'

interface Props {
  /** The inbox this bell opens. */
  href: string
  /** Where to land on closing when the inbox was opened directly. */
  home: string
}

/**
 * Top-right inbox shortcut, and the way out of it: tapping the bell while the
 * inbox is open closes it again rather than doing nothing.
 */
export function AlertBell({ href, home }: Props) {
  const { unread } = useAlerts()
  const router = useRouter()
  const path = usePathname()
  const [hasHistory, setHasHistory] = useState(false)
  const open = path === href

  useEffect(() => {
    setHasHistory(window.history.length > 1)
  }, [path])

  const toggle = () => {
    if (!open) {
      router.push(href)
      return
    }
    if (hasHistory) router.back()
    else router.replace(home)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
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
          className="absolute right-1.5 top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-out-deep px-1 text-[9px] font-bold leading-none text-white"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
