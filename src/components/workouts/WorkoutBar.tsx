'use client'

import Link from 'next/link'
import { ChevronUp } from 'lucide-react'
import { useWorkout } from '@/stores/workout'
import { useHydrated } from '@/hooks/useHydrated'
import { useNow } from '@/hooks/useNow'
import { clock } from '@/lib/workouts'

/** A running workout follows the member around the app, one tap from coming back. */
export function WorkoutBar() {
  const hydrated = useHydrated()
  const session = useWorkout(state => state.session)
  const rest = useWorkout(state => state.rest)
  const now = useNow(1000, session !== null)
  if (!hydrated || !session) return null

  const resting = rest && rest.endsAt > now
  return (
    <Link
      href="/m/workouts/live"
      className="fixed inset-x-3.5 bottom-[calc(var(--nav-offset)+0.75rem)] z-30 mx-auto flex h-14 max-w-md animate-rise items-center gap-3 rounded-lg bg-base-raised px-4 shadow-lift"
    >
      <span aria-hidden className="relative grid h-2.5 w-2.5 place-items-center">
        <span className="absolute inset-0 animate-pulse-out rounded-full bg-live" />
        <span className="h-2.5 w-2.5 rounded-full bg-live" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{session.name}</span>
      <span className="figure text-[20px] text-live">
        {resting ? `Rest ${clock((rest.endsAt - now) / 1000)}` : clock((now - session.startedAt) / 1000)}
      </span>
      <ChevronUp size={20} aria-hidden className="text-mute" />
    </Link>
  )
}
