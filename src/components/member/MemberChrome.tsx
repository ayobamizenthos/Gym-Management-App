'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, CreditCard, Users, UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'

const TABS = [
  { href: '/m', label: 'Membership', icon: Dumbbell },
  { href: '/m/renew', label: 'Renew', icon: CreditCard },
  { href: '/m/referrals', label: 'Invite', icon: Users },
  { href: '/m/account', label: 'Account', icon: UserRound },
]

export function MemberChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <main className="flex-1 px-5 pb-28 pt-6">{children}</main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-2xl grid-cols-4 border-t border-line bg-ink"
      >
        {TABS.map(tab => {
          const active = path === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 py-3 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                active ? 'text-good' : 'text-mute hover:text-ink'
              )}
            >
              <tab.icon size={19} aria-hidden />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
