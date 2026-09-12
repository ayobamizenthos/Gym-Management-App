'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAlerts } from '@/stores/alerts'

/** Top-right inbox shortcut. The count is the whole point, so it never hides. */
export function AlertBell({ href }: { href: string }) {
  const { unread } = useAlerts()
  return (
    <Link
      href={href}
      aria-label={unread > 0 ? unread + ' unread alerts' : 'Alerts'}
      className="relative -mr-2.5 grid h-11 w-11 place-items-center text-mute transition-colors hover:text-chalk"
    >
      <Bell size={19} aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute right-1.5 top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-out-deep px-1 text-[9px] font-bold leading-none text-white"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
