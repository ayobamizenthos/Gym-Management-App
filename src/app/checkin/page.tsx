import { Suspense } from 'react'
import { Loader } from '@/components/Loader'
import CheckInScreen from './CheckInScreen'

export default function CheckInPage() {
  return (
    <Suspense fallback={<Loader full label="Reading your membership" />}>
      <CheckInScreen />
    </Suspense>
  )
}
