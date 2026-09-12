'use client'

import { Banknote, ScanLine, UserRound } from 'lucide-react'
import { MoreMenu } from '@/components/MoreMenu'

export default function DeskMore() {
  return (
    <MoreMenu
      title="More"
      groups={[
        {
          heading: 'Front desk',
          links: [
            { href: '/desk/payments', label: 'Payments', hint: 'Confirm transfers and see what has been paid', icon: Banknote },
            { href: '/checkin', label: 'Check in a member', hint: 'Open the check-in screen on this device', icon: ScanLine },
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
