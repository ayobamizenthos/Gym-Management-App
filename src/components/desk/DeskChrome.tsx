'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Users, Banknote, LogOut } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/cn'

const TABS = [
  { href: '/desk', label: 'Live', icon: Activity },
  { href: '/desk/members', label: 'Members', icon: Users },
  { href: '/desk/payments', label: 'Payments', icon: Banknote },
]

export function DeskChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[210px_1fr]">
      {/* Desktop rail */}
      <aside className="hidden border-r border-edge md:flex md:flex-col">
        <div className="flex h-16 items-center px-5 font-display text-xl uppercase tracking-tightest">
          Zenthos<span className="text-live">Gym</span>
        </div>
        <nav aria-label="Front desk" className="flex flex-1 flex-col gap-1 p-3">
          {TABS.map(t => {
            const active = path === t.href
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
        {/* Mobile bar */}
        <header className="flex h-14 items-center justify-between border-b border-edge px-4 md:hidden">
          <span className="font-display text-lg uppercase tracking-tightest">
            Zenthos<span className="text-live">Gym</span>
          </span>
          <button onClick={signOut} aria-label="Sign out" className="-mr-2.5 grid h-11 w-11 place-items-center text-mute transition-colors hover:text-out">
            <LogOut size={18} aria-hidden />
          </button>
        </header>

        <main className="pad-nav flex-1 px-4 pt-5 md:px-8 md:pb-8">{children}</main>

        <nav aria-label="Front desk" className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-edge bg-base md:hidden">
          {TABS.map(t => {
            const active = path === t.href
            return (
              <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center gap-1 py-3 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                  active ? 'text-live' : 'text-mute hover:text-chalk')}>
                <t.icon size={19} aria-hidden />{t.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
