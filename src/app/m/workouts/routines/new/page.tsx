'use client'

import { RoutineEditor } from '@/components/workouts/RoutineEditor'
import { useAuth } from '@/stores/auth'
import { useRoutines } from '@/lib/workouts'

export default function NewRoutinePage() {
  const { profile } = useAuth()
  const { mine, revalidate } = useRoutines(profile?.id)
  if (!profile) return null
  return <RoutineEditor ownerId={profile.id} position={mine.length} onSaved={revalidate} />
}
