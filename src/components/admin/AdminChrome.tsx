'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Users, Tags, Building2, Shield, Settings as Cog, LogOut, Activity } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/cn'

const LINKS = [
  { href: '/admin',           label: 'Overview', icon: BarChart3 },
  { href: '/admin/members',   label: 'Members',  icon: Users },
  { href: '/admin/plans',     label: 'Plans',    icon: Tags },
  { href: '/admin/branches',  label: 'Branches', icon: Building2 },
  { href: '/admin/staff',     label: 'Staff',    icon: Shield },
  { href: '/admin/settings',  label: 'Settings', icon: Cog },
]

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="hidden border-r border-line lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-5 font-display text-xl uppercase tracking-tightest">
          Zenthos<span className="text-good">Gym</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {LINKS.map(l => {
            const active = path === l.href
            return (
              <Link key={l.href} href={l.href}
                className={cn('flex items-center gap-3 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors',
                  active ? 'bg-good text-ink' : 'text-mute hover:text-ink')}>
                <l.icon size={17} />{l.label}
              </Link>
            )
          })}
          <Link href="/desk" className="mt-2 flex items-center gap-3 border-t border-line px-3 pt-5 text-sm font-semibold uppercase tracking-wide text-mute hover:text-good">
            <Activity size={17} /> Front desk
          </Link>
        </nav>
        <div className="border-t border-line p-3">
          <p className="px-3 pb-1 text-xs uppercase tracking-[0.2em] text-mute">Signed in</p>
          <p className="truncate px-3 pb-3 text-sm">{profile?.full_name}</p>
          <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-mute hover:text-alert">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center justify-between border-b border-line px-4 lg:hidden">
          <span className="font-display text-lg uppercase tracking-tightest">
            Zenthos<span className="text-good">Gym</span>
          </span>
          <button onClick={signOut} aria-label="Sign out" className="text-mute"><LogOut size={18} /></button>
        </header>

        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
          {LINKS.map(l => {
            const active = path === l.href
            return (
              <Link key={l.href} href={l.href}
                className={cn('shrink-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide',
                  active ? 'bg-good text-ink' : 'text-mute')}>
                {l.label}
              </Link>
            )
          })}
        </div>

        <main className="flex-1 px-4 py-6 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
