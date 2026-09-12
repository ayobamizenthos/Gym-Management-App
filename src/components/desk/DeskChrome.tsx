'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Users, UserPlus, Bell, LayoutGrid, Banknote, LogOut } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { BottomNav } from '@/components/BottomNav'
import { AlertBell } from '@/components/AlertBell'
import { cn } from '@/lib/cn'

const RAIL = [
  { href: '/desk', label: 'Live', icon: Activity },
  { href: '/desk/members', label: 'Members', icon: Users },
  { href: '/desk/payments', label: 'Payments', icon: Banknote },
  { href: '/desk/alerts', label: 'Alerts', icon: Bell },
  { href: '/desk/more', label: 'More', icon: LayoutGrid },
]

export function DeskChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[210px_1fr]">
      <aside className="hidden border-r border-edge md:flex md:flex-col">
        <div className="flex h-16 items-center px-5 font-display text-xl uppercase tracking-tightest">
          Zenthos<span className="text-live">Gym</span>
        </div>
        <nav aria-label="Front desk" className="flex flex-1 flex-col gap-1 p-3">
          {RAIL.map(t => {
            const active = path === t.href || path.startsWith(t.href + '/')
            return (
              <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
                className={cn('flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors',
                  active ? 'bg-live text-ink' : 'text-mute hover:text-chalk')}>
                <t.icon size={17} aria-hidden />{t.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-edge p-3">
          <p className="px-3 pb-2 text-xs uppercase tracking-[0.2em] text-mute">Front desk</p>
          <p className="truncate px-3 pb-3 text-sm">{profile?.full_name}</p>
          <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-mute hover:text-out">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center justify-between border-b border-edge px-4 md:hidden">
          <span className="font-display text-lg uppercase tracking-tightest">
            Zenthos<span className="text-live">Gym</span>
          </span>
          <AlertBell href="/desk/alerts" home="/desk" />
        </header>

        <main className="pad-nav flex-1 px-4 pt-5 md:px-8 md:pb-8">{children}</main>

        <div className="md:hidden">
          <BottomNav
            label="Front desk"
            left={[
              { href: '/desk', label: 'Live', icon: Activity },
              { href: '/desk/members', label: 'Members', icon: Users, section: '/desk/members' },
            ]}
            action={{ href: '/desk/members/new', label: 'Register', icon: UserPlus }}
            right={[
              { href: '/desk/payments', label: 'Payments', icon: Banknote },
              { href: '/desk/more', label: 'More', icon: LayoutGrid },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
