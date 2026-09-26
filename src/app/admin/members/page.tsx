import { Suspense } from 'react'
import { MembersScreen } from '@/components/members/MembersScreen'

export default function Members() {
  return (
    <Suspense>
      <MembersScreen />
    </Suspense>
  )
}
