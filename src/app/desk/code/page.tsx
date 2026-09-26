'use client'

import { useAuth } from '@/stores/auth'
import { EntranceCode } from '@/components/EntranceCode'
import { BackLink } from '@/components/BackLink'

/** The front desk prints the code for the branch it works at, and only that one. */
export default function DeskEntranceCode() {
  const { profile } = useAuth()

  if (!profile?.branch_id) {
    return (
      <div className="animate-rise">
        <BackLink fallback="/desk/more" label="More" />
        <p className="py-20 text-center text-[15px] text-mute">Ask the admin to assign you to a branch.</p>
      </div>
    )
  }

  return <EntranceCode branchId={profile.branch_id} back={{ fallback: '/desk/more', label: 'More' }} />
}
