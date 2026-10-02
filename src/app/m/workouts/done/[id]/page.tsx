'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WorkoutSummary } from '@/components/workouts/WorkoutSummary'
import { useWorkoutById } from '@/lib/workouts'
import { useHydrated } from '@/hooks/useHydrated'
import { useWorkout } from '@/stores/workout'

/** Straight after Finish. Reopened later, without the result in hand, it becomes the plain summary. */
export default function WorkoutDonePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const hydrated = useHydrated()
  const celebrate = useWorkout(state => state.celebrate)
  const { data: workout, settled } = useWorkoutById(id)
  const result = celebrate?.id === id ? celebrate : null

  useEffect(() => {
    if (hydrated && !result) router.replace(`/m/workouts/history/${id}`)
  }, [hydrated, result, id, router])

  if (!workout) {
    return settled ? null : <div className="mx-auto mt-24 h-24 w-24 animate-pulse rounded-full bg-base-panel" aria-busy="true" aria-label="Saving workout" />
  }
  if (!result) return null
  return <WorkoutSummary workout={workout} result={result} />
}
