'use client'

import { Dumbbell, ReceiptText, ScanLine, Bell, UserRound } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'

export function MemberChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <main className="pad-nav flex-1 px-5 pt-6">{children}</main>
      <BottomNav
        label="Main"
        left={[
          { href: '/m', label: 'Home', icon: Dumbbell },
          { href: '/m/history', label: 'Payments', icon: ReceiptText },
        ]}
        action={{ href: '/m/scan', label: 'Check in', icon: ScanLine }}
        right={[
          { href: '/m/alerts', label: 'Alerts', icon: Bell, badge: true },
          { href: '/m/account', label: 'Account', icon: UserRound },
        ]}
      />
    </div>
  )
}
