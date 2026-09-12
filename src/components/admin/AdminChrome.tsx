'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Users, Tags, Building2, Shield, Settings as Cog, LogOut, Activity,
  Bell, LayoutGrid, Banknote,
} from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { BottomNav } from '@/components/BottomNav'
import { AlertBell } from '@/components/AlertBell'
import { cn } from '@/lib/cn'

const RAIL = [
  { href: '/admin',          label: 'Overview', icon: BarChart3 },
  { href: '/admin/members',  label: 'Members',  icon: Users },
  { href: '/desk',           label: 'Live',     icon: Activity },
  { href: '/desk/payments',  label: 'Payments', icon: Banknote },
  { href: '/admin/plans',    label: 'Plans',    icon: Tags },
  { href: '/admin/branches', label: 'Branches', icon: Building2 },
  { href: '/admin/staff',    label: 'Staff',    icon: Shield },
  { href: '/admin/alerts',   label: 'Alerts',   icon: Bell },
  { href: '/admin/settings', label: 'Settings', icon: Cog },
]

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="hidden border-r border-edge lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-5 font-display text-xl uppercase tracking-tightest">
          Zenthos<span className="text-live">Gym</span>
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 p-3">
          {RAIL.map(l => {
            const active = path === l.href
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                className={cn('flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors',
                  active ? 'bg-live text-ink' : 'text-mute hover:text-chalk')}>
                <l.icon size={17} aria-hidden />{l.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-edge p-3">
          <p className="px-3 pb-1 text-xs uppercase tracking-[0.2em] text-mute">Signed in</p>
          <p className="truncate px-3 pb-3 text-sm">{profile?.full_name}</p>
          <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-mute hover:text-out">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center justify-end px-4 lg:hidden">
          <AlertBell href="/admin/alerts" home="/admin" />
        </header>

        <main className="pad-nav flex-1 px-4 lg:px-10 lg:pb-10 lg:pt-6">{children}</main>

        <div className="lg:hidden">
          <BottomNav
            label="Admin"
            swipe={{ right: { href: '/m', label: 'My membership' } }}
            left={[
              { href: '/admin', label: 'Overview', icon: BarChart3 },
              { href: '/admin/members', label: 'Members', icon: Users },
            ]}
            action={{ href: '/desk', label: 'Live', icon: Activity }}
            right={[
              { href: '/admin/plans', label: 'Plans', icon: Tags },
              { href: '/admin/more', label: 'More', icon: LayoutGrid },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
