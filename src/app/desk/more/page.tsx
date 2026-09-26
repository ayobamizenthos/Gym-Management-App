'use client'

import { Banknote, QrCode, UserRound } from 'lucide-react'
import { MoreMenu } from '@/components/MoreMenu'

export default function DeskMore() {
  return (
    <MoreMenu
      title="More"
      groups={[
        {
          heading: 'Front desk',
          links: [
            { href: '/desk/payments', label: 'Payments', icon: Banknote },
            { href: '/desk/code', label: 'Entrance code', icon: QrCode },
          ],
        },
        {
          heading: 'You',
          links: [
            { href: '/desk/account', label: 'Your account', icon: UserRound },
          ],
        },
      ]}
    />
  )
}
