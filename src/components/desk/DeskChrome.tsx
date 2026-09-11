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
      <aside className="hidden border-r border-ink-line md:flex md:flex-col">
        <div className="flex h-16 items-center px-5 font-display text-xl uppercase tracking-tightest">
          Zenthos<span className="text-volt">Gym</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {TABS.map(t => {
            const active = path === t.href
            return (
              <Link key={t.href} href={t.href}
                className={cn('flex items-center gap-3 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors',
                  active ? 'bg-volt text-ink' : 'text-ink-mute hover:text-paper')}>
                <t.icon size={17} />{t.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-ink-line p-3">
          <p className="px-3 pb-2 text-xs uppercase tracking-[0.2em] text-ink-mute">Front desk</p>
          <p className="truncate px-3 pb-3 text-sm">{profile?.full_name}</p>
          <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-ink-mute hover:text-alert">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Mobile bar */}
        <header className="flex h-14 items-center justify-between border-b border-ink-line px-4 md:hidden">
          <span className="font-display text-lg uppercase tracking-tightest">
            Zenthos<span className="text-volt">Gym</span>
          </span>
          <button onClick={signOut} aria-label="Sign out" className="text-ink-mute"><LogOut size={18} /></button>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-ink-line bg-ink md:hidden">
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
    </div>
  )
}
