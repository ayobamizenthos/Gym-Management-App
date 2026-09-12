'use client'

import { Dumbbell, CreditCard, ScanLine, ReceiptText, UserRound } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { AlertBell } from '@/components/AlertBell'

export function MemberChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* The inbox lives top right, the same place it sits on the staff screens.
          It floats over the page so the photographic headers keep the full bleed. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto flex max-w-2xl justify-end px-3 pt-2">
        <span className="pointer-events-auto rounded-full bg-base/70 backdrop-blur-sm">
          <AlertBell href="/m/alerts" home="/m" />
        </span>
      </div>

      <main className="pad-nav flex-1 px-5 pt-6">{children}</main>

      <BottomNav
        label="Main"
        left={[
          { href: '/m', label: 'Home', icon: Dumbbell },
          { href: '/m/renew', label: 'Renew', icon: CreditCard },
        ]}
        action={{ href: '/m/scan', label: 'Check in', icon: ScanLine }}
        right={[
          { href: '/m/history', label: 'Payments', icon: ReceiptText },
          { href: '/m/account', label: 'Account', icon: UserRound },
        ]}
      />
    </div>
  )
}
