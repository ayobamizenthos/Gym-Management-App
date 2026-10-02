'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3, Users, Tags, Building2, Shield, Settings as Cog, LogOut, Activity,
  Bell, LayoutGrid, Banknote,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { BottomNav, type NavItem } from '@/components/BottomNav'
import { AlertBell } from '@/components/AlertBell'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/cn'

export type Workspace = 'admin' | 'desk'

interface RailLink {
  href: string
  label: string
  icon: LucideIcon
}

interface WorkspaceLayout {
  label: string
  caption: string
  home: string
  alerts: string
  rail: RailLink[]
  left: [NavItem, NavItem]
  right: [NavItem, NavItem]
}

const LIVE = { href: '/desk', label: 'Live', icon: Activity }
const TO_MEMBERSHIP = { right: { href: '/m', label: 'My membership' } }

const WORKSPACES: Record<Workspace, WorkspaceLayout> = {
  admin: {
    label: 'Admin',
    caption: 'Signed in',
    home: '/admin',
    alerts: '/admin/alerts',
    rail: [
      { href: '/admin', label: 'Overview', icon: BarChart3 },
      { href: '/admin/members', label: 'Members', icon: Users },
      LIVE,
      { href: '/desk/payments', label: 'Payments', icon: Banknote },
      { href: '/admin/plans', label: 'Plans', icon: Tags },
      { href: '/admin/branches', label: 'Branches', icon: Building2 },
      { href: '/admin/staff', label: 'Staff', icon: Shield },
      { href: '/admin/alerts', label: 'Alerts', icon: Bell },
      { href: '/admin/settings', label: 'Settings', icon: Cog },
    ],
    left: [
      { href: '/admin', label: 'Overview', icon: BarChart3 },
      { href: '/admin/members', label: 'Members', icon: Users },
    ],
    right: [
      { href: '/admin/plans', label: 'Plans', icon: Tags },
      { href: '/admin/more', label: 'More', icon: LayoutGrid },
    ],
  },
  desk: {
    label: 'Front desk',
    caption: 'Front desk',
    home: '/desk/overview',
    alerts: '/desk/alerts',
    rail: [
      { href: '/desk/overview', label: 'Overview', icon: BarChart3 },
      { href: '/desk/members', label: 'Members', icon: Users },
      LIVE,
      { href: '/desk/payments', label: 'Payments', icon: Banknote },
      { href: '/desk/alerts', label: 'Alerts', icon: Bell },
      { href: '/desk/more', label: 'More', icon: LayoutGrid },
    ],
    left: [
      { href: '/desk/overview', label: 'Overview', icon: BarChart3 },
      { href: '/desk/members', label: 'Members', icon: Users, section: '/desk/members' },
    ],
    right: [
      { href: '/desk/payments', label: 'Payments', icon: Banknote },
      { href: '/desk/more', label: 'More', icon: LayoutGrid },
    ],
  },
}

/** Staff chrome: a side rail from tablet width up, the bottom bar below it. */
export function WorkspaceChrome({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const layout = WORKSPACES[workspace]
  const path = usePathname()
  const router = useRouter()
  const { profile, signOut } = useAuth()

  const leave = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-edge pt-[env(safe-area-inset-top)] md:flex md:flex-col">
        <div className="flex h-16 items-center px-5 font-display text-xl uppercase tracking-tightest">
          <Logo />
        </div>
        <nav aria-label={layout.label} className="flex flex-1 flex-col gap-1 p-3">
          {layout.rail.map(link => {
            const active = path === link.href
            return (
              <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}
                className={cn('flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors',
                  active ? 'bg-live text-ink' : 'text-mute hover:text-chalk')}>
                <link.icon size={17} aria-hidden />{link.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-edge p-3">
          <p className="px-3 pb-1 text-xs uppercase tracking-[0.2em] text-mute">{layout.caption}</p>
          <p className="truncate px-3 pb-3 text-sm">{profile?.full_name}</p>
          <button onClick={() => void leave()} className="flex min-h-[44px] w-full items-center gap-3 px-3 text-sm text-mute hover:text-out">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="box-content flex h-14 items-center justify-end px-4 pt-[env(safe-area-inset-top)] md:hidden">
          <AlertBell href={layout.alerts} home={layout.home} />
        </header>

        <main className="pad-nav flex-1 px-4 md:px-8 md:pb-8 md:pt-[calc(1.25rem+env(safe-area-inset-top))]">{children}</main>

        <div className="md:hidden">
          <BottomNav label={layout.label} swipe={TO_MEMBERSHIP} left={layout.left} action={LIVE} right={layout.right} />
        </div>
      </div>
    </div>
  )
}
