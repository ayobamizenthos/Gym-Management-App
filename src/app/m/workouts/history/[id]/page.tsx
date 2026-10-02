'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { WorkoutSummary } from '@/components/workouts/WorkoutSummary'
import { useWorkoutById } from '@/lib/workouts'

export default function WorkoutHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const { data: workout, settled } = useWorkoutById(id)

  if (workout) return <WorkoutSummary workout={workout} result={null} />
  if (!settled) return <div className="mt-16 h-40 animate-pulse rounded-lg bg-base-panel" aria-busy="true" aria-label="Loading workout" />
  return (
    <div className="pt-10 text-center">
      <h1 className="text-3xl">Not found</h1>
      <p className="mt-2 text-[15px] text-mute">This workout is not in your history.</p>
      <Link href="/m/workouts/progress" className="btn-quiet mx-auto mt-6 w-48">Your progress</Link>
    </div>
  )
}
