'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, CreditCard, Users, Receipt } from 'lucide-react'
import { cn } from '@/lib/cn'

const TABS = [
  { href: '/m',            label: 'Membership', icon: Dumbbell },
  { href: '/m/renew',      label: 'Renew',      icon: CreditCard },
  { href: '/m/referrals',  label: 'Invite',     icon: Users },
  { href: '/m/history',    label: 'History',    icon: Receipt },
]

export function MemberChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <main className="flex-1 px-5 pb-28 pt-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-2xl grid-cols-4 border-t border-ink-line bg-ink">
        {TABS.map(t => {
          const active = path === t.href
          return (
            <Link key={t.href} href={t.href}
              className={cn('flex flex-col items-center gap-1 py-3 text-[11px] font-semibold uppercase tracking-wide',
                active ? 'text-volt' : 'text-ink-mute')}>
              <t.icon size={19} />{t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
