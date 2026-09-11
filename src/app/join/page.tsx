import { Suspense } from 'react'
import { Loader } from '@/components/Loader'
import JoinScreen from './JoinScreen'

export default function JoinPage() {
  return (
    <Suspense fallback={<Loader full />}>
      <JoinScreen />
    </Suspense>
  )
}
