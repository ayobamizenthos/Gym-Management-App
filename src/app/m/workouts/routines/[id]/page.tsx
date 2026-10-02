'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { Dialog } from '@/components/Dialog'
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb'
import { RoutineEditor } from '@/components/workouts/RoutineEditor'
import { useAuth } from '@/stores/auth'
import { useWorkout } from '@/stores/workout'
import { useToasts } from '@/stores/toast'
import { useExercises } from '@/lib/exercises'
import { startWorkout } from '@/lib/workout-session'
import { restLabel, useRoutines } from '@/lib/workouts'
import type { Routine } from '@/lib/workouts'
import { supabase } from '@/lib/supabase'
import { plural } from '@/lib/format'

function describe(entry: Routine['entries'][number]) {
  const working = entry.sets.filter(set => set.kind === 'normal')
  const reps = working[0]?.reps
  const sets = `${working.length} ${plural(working.length, 'set')}${reps ? ` × ${reps}` : ''}`
  return entry.rest > 0 ? `${sets} · rest ${restLabel(entry.rest)}` : sets
}

function Preview({ routine, mine, onCopied }: { routine: Routine; mine: Routine[]; onCopied: () => Promise<unknown> }) {
  const router = useRouter()
  const { profile } = useAuth()
  const { byId } = useExercises()
  const session = useWorkout(state => state.session)
  const push = useToasts(state => state.push)
  const [copying, setCopying] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const saved = mine.some(own => own.name === routine.name)

  const start = () => {
    startWorkout(routine.name, routine.id, routine.entries)
    router.push('/m/workouts/live')
  }

  const copy = async () => {
    if (!profile) return
    setCopying(true)
    const { error } = await supabase
      .from('routines')
      .insert({ owner_id: profile.id, name: routine.name, entries: routine.entries, position: mine.length })
    setCopying(false)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: 'Check your connection and try again.' })
      return
    }
    await onCopied()
    push({ tone: 'good', title: 'Saved to My routines', message: 'Change the sets and reps any time.' })
  }

  return (
    <div className="pb-44">
      <Link href="/m/workouts" aria-label="Back to workouts" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-base-raised">
        <ChevronLeft size={26} aria-hidden />
      </Link>
      <h1 className="mt-2 text-[40px]">{routine.name}</h1>
      <p className="mt-2 text-[15px] text-mute">
        {routine.summary ? `${routine.summary} · ` : ''}
        {routine.entries.length} {plural(routine.entries.length, 'exercise')}
      </p>

      <ol className="mt-6 flex flex-col gap-1">
        {routine.entries.map((entry, index) => (
          <li key={entry.exercise_id + index}>
            <Link href={`/m/workouts/exercises/${entry.exercise_id}`} className="flex items-center gap-3.5 py-2">
              <ExerciseThumb id={entry.exercise_id} size={60} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{byId.get(entry.exercise_id)?.name ?? '…'}</span>
                <span className="mt-0.5 block text-[13px] text-mute">{describe(entry)}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-mute" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-base via-base/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto flex max-w-md gap-2.5">
          <button type="button" onClick={copy} disabled={copying || saved} className="btn-quiet flex-1">
            {saved ? 'In My routines' : copying ? 'Saving' : 'Save to mine'}
          </button>
          <button
            type="button"
            onClick={() => (session ? setReplacing(true) : start())}
            className="btn flex-[1.4] bg-live text-ink"
          >
            <Play size={16} fill="currentColor" aria-hidden />
            Start workout
          </button>
        </div>
      </div>

      {replacing && (
        <Dialog
          title="Start a new workout?"
          body={`${session?.name ?? 'Your current workout'} is still running. Starting another discards it.`}
          confirmLabel="Discard and start"
          tone="danger"
          onConfirm={start}
          onClose={() => setReplacing(false)}
        />
      )}
    </div>
  )
}

export default function RoutinePage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { mine, explore, loading, revalidate } = useRoutines(profile?.id)
  const routine = [...mine, ...explore].find(item => item.id === id)

  if (!profile || (loading && !routine)) return null
  if (!routine) {
    return (
      <div className="pt-10 text-center">
        <h1 className="text-3xl">Not found</h1>
        <p className="mt-2 text-[15px] text-mute">This routine may have been deleted.</p>
        <Link href="/m/workouts" className="btn-quiet mx-auto mt-6 w-48">Back to workouts</Link>
      </div>
    )
  }
  if (routine.owner_id === null) return <Preview routine={routine} mine={mine} onCopied={revalidate} />
  return <RoutineEditor key={routine.id} ownerId={profile.id} routine={routine} position={routine.position} onSaved={revalidate} />
}
