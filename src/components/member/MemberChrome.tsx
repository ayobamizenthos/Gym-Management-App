'use client'

import { usePathname } from 'next/navigation'
import { Dumbbell, CreditCard, ScanLine, Users, UserRound } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { useAuth } from '@/stores/auth'
import { AlertBell } from '@/components/AlertBell'

// Scanning is a full-screen moment; nothing floats over it.
const BARE = ['/m/scan']

export function MemberChrome({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  const path = usePathname()
  const staffHome =
    role === 'admin'
      ? { href: '/admin', label: 'Dashboard' }
      : role === 'receptionist'
        ? { href: '/desk', label: 'Front desk' }
        : null

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* The inbox lives top right, the same place it sits on the staff screens.
          It floats over the page so the photographic headers keep the full bleed. */}
      {!BARE.includes(path) && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto flex max-w-2xl justify-end px-3 pt-2">
          <span className="pointer-events-auto rounded-full bg-base/70 backdrop-blur-sm">
            <AlertBell href="/m/alerts" home="/m" />
          </span>
        </div>
      )}

      <main className="pad-nav flex-1 px-5 pt-6">{children}</main>

      <BottomNav
        label="Main"
        swipe={staffHome ? { left: staffHome } : undefined}
        left={[
          { href: '/m', label: 'Home', icon: Dumbbell },
          { href: '/m/renew', label: 'Renew', icon: CreditCard },
        ]}
        action={{ href: '/m/scan', label: 'Check in', icon: ScanLine }}
        right={[
          { href: '/m/referrals', label: 'Invite', icon: Users },
          { href: '/m/account', label: 'Account', icon: UserRound },
        ]}
      />
    </div>
  )
}
