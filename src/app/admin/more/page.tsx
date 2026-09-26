'use client'

import { Activity, Banknote, Building2, Settings as Cog, Shield, UserRound } from 'lucide-react'
import { MoreMenu } from '@/components/MoreMenu'

export default function AdminMore() {
  return (
    <MoreMenu
      title="More"
      groups={[
        {
          heading: 'Run the gym',
          links: [
            { href: '/admin/branches', label: 'Branches', icon: Building2 },
            { href: '/admin/staff', label: 'Staff', icon: Shield },
            { href: '/admin/settings', label: 'Settings', icon: Cog },
          ],
        },
        {
          heading: 'Front desk',
          links: [
            { href: '/desk', label: 'Live check-in', icon: Activity },
            { href: '/desk/payments', label: 'Payments', icon: Banknote },
          ],
        },
        {
          heading: 'You',
          links: [
            { href: '/admin/account', label: 'Your account', icon: UserRound },
          ],
        },
      ]}
    />
  )
}
