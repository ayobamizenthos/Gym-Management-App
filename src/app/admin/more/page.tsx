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
            { href: '/admin/branches', label: 'Branches', hint: 'Locations and their entrance codes', icon: Building2 },
            { href: '/admin/staff', label: 'Staff', hint: 'Who can work the desk and who can see revenue', icon: Shield },
            { href: '/admin/settings', label: 'Settings', hint: 'Fees, renewals, referrals and check-in', icon: Cog },
          ],
        },
        {
          heading: 'Front desk',
          links: [
            { href: '/desk', label: 'Live check-in', hint: 'Watch members arrive in real time', icon: Activity },
            { href: '/desk/payments', label: 'Payments', hint: 'Confirm transfers waiting at the desk', icon: Banknote },
          ],
        },
        {
          heading: 'You',
          links: [
            { href: '/m/account', label: 'Your account', hint: 'Photo, phone and password', icon: UserRound },
          ],
        },
      ]}
    />
  )
}
