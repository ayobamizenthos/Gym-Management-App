'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChartNoAxesColumn, Check, Ellipsis, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { ActionSheet } from '@/components/ActionSheet'
import { Dialog } from '@/components/Dialog'
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb'
import { useAuth } from '@/stores/auth'
import { useWorkout } from '@/stores/workout'
import { useToasts } from '@/stores/toast'
import { useHydrated } from '@/hooks/useHydrated'
import { supabase } from '@/lib/supabase'
import { emptyWorkoutName, startWorkout } from '@/lib/workout-session'
import { dayKey, secondsBetween, spoken, startOfWeek, useRoutines, useWorkoutHistory } from '@/lib/workouts'
import type { Routine, Workout } from '@/lib/workouts'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const THUMBS = 4

function lastDone(workouts: Workout[], routineId: string) {
  const latest = workouts.find(workout => workout.routine_id === routineId)
  if (!latest) return null
  const ended = new Date(latest.ended_at)
  if (dayKey(ended) === dayKey(new Date())) return 'Done today'
  if (ended >= startOfWeek(new Date())) return `Last done ${ended.toLocaleDateString('en-NG', { weekday: 'long' })}`
  return `Last done ${ended.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`
}

function WeekStrip({ workouts }: { workouts: Workout[] }) {
  const monday = startOfWeek(new Date())
  const today = dayKey(new Date())
  const thisWeek = workouts.filter(workout => new Date(workout.ended_at) >= monday)
  const trained = new Set(thisWeek.map(workout => dayKey(new Date(workout.ended_at))))
  const seconds = thisWeek.reduce((sum, workout) => sum + secondsBetween(workout.started_at, workout.ended_at), 0)

  return (
    <Link href="/m/workouts/progress" className="panel mt-5 block p-4 transition-colors active:bg-base-raised">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">This week</span>
        <span className="text-[13px] text-mute">
          {thisWeek.length === 0 ? 'No workouts yet' : `${thisWeek.length} ${plural(thisWeek.length, 'workout')} · ${spoken(seconds)}`}
        </span>
      </span>
      <span className="mt-3.5 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((letter, index) => {
          const day = new Date(monday)
          day.setDate(monday.getDate() + index)
          const key = dayKey(day)
          const done = trained.has(key)
          const isToday = key === today
          return (
            <span key={index} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full',
                  done ? 'bg-live text-ink' : 'bg-base-raised',
                  isToday && !done && 'ring-2 ring-inset ring-chalk'
                )}
              >
                {done && <Check size={16} strokeWidth={3} aria-hidden />}
              </span>
              <span className={cn('text-[12px] font-semibold', isToday ? 'text-chalk' : 'text-mute')}>{letter}</span>
            </span>
          )
        })}
      </span>
    </Link>
  )
}

function RoutineCard({ routine, note, onStart, onMenu }: { routine: Routine; note: string; onStart: () => void; onMenu: () => void }) {
  const extra = routine.entries.length - THUMBS
  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-bold">{routine.name}</h3>
          <p className="mt-0.5 truncate text-[13px] text-mute">{note}</p>
        </div>
        <button type="button" onClick={onMenu} aria-label={`${routine.name} options`} className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-mute active:bg-base-raised">
          <Ellipsis size={21} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {routine.entries.slice(0, THUMBS).map(entry => (
          <ExerciseThumb key={entry.exercise_id} id={entry.exercise_id} size={46} />
        ))}
        {extra > 0 && (
          <span className="grid h-[46px] w-[46px] place-items-center rounded-[12px] bg-base-raised text-[13px] font-semibold text-mute">+{extra}</span>
        )}
        <button
          type="button"
          onClick={onStart}
          className="ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-live pl-4 pr-5 text-[15px] font-semibold text-ink transition-transform active:scale-95"
        >
          <Play size={15} fill="currentColor" aria-hidden />
          Start
        </button>
      </div>
    </article>
  )
}

/** Each card leads with a different movement, so two plans that both open on squats still look apart. */
function covers(routines: Routine[]) {
  const used = new Set<string>()
  return new Map(
    routines.map(routine => {
      const pick = routine.entries.find(entry => !used.has(entry.exercise_id)) ?? routine.entries[0]
      if (pick) used.add(pick.exercise_id)
      return [routine.id, pick?.exercise_id]
    })
  )
}

function ExploreCard({ routine, cover }: { routine: Routine; cover: string | undefined }) {
  return (
    <Link href={`/m/workouts/routines/${routine.id}`} className="panel w-[232px] shrink-0 snap-start overflow-hidden transition-transform active:scale-[.98]">
      <span className="flex h-[124px] items-center justify-center bg-white">
        {cover && <ExerciseThumb id={cover} size={124} />}
      </span>
      <span className="block px-3.5 pb-3.5 pt-3">
        <span className="block truncate text-[15px] font-bold">{routine.name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-mute">
          {routine.summary ?? `${routine.entries.length} exercises`}
        </span>
      </span>
    </Link>
  )
}

export default function WorkoutsPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const { profile } = useAuth()
  const session = useWorkout(state => state.session)
  const push = useToasts(state => state.push)
  const { mine, explore, loading, revalidate } = useRoutines(profile?.id)
  const { workouts } = useWorkoutHistory(profile?.id)
  const [menu, setMenu] = useState<Routine | null>(null)
  const [deleting, setDeleting] = useState<Routine | null>(null)
  const [replacing, setReplacing] = useState<(() => void) | null>(null)

  const heroes = useMemo(() => covers(explore), [explore])
  const notes = useMemo(
    () => new Map(mine.map(routine => [routine.id, lastDone(workouts, routine.id) ?? `${routine.entries.length} ${plural(routine.entries.length, 'exercise')}`])),
    [mine, workouts]
  )

  // starting over a running session would throw it away, so ask first
  const begin = (start: () => void) => {
    if (hydrated && session) {
      setReplacing(() => start)
      return
    }
    start()
    router.push('/m/workouts/live')
  }

  const removeRoutine = async (routine: Routine) => {
    const { error } = await supabase.from('routines').delete().eq('id', routine.id)
    if (error) push({ tone: 'bad', title: 'Routine not deleted', message: 'Check your connection and try again.' })
    await revalidate()
  }

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between gap-3 pt-2">
        <h1 className="text-[44px]">Workouts</h1>
        <Link href="/m/workouts/progress" aria-label="Your progress" className="grid h-11 w-11 place-items-center rounded-full bg-base-panel active:bg-base-raised">
          <ChartNoAxesColumn size={20} aria-hidden />
        </Link>
      </div>

      <WeekStrip workouts={workouts} />

      <button
        type="button"
        onClick={() => begin(() => startWorkout(emptyWorkoutName(), null, []))}
        className="btn-quiet mt-3 w-full"
      >
        <Plus size={19} aria-hidden />
        Start empty workout
      </button>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-2xl">My routines</h2>
        <Link href="/m/workouts/routines/new" className="-mr-2 flex h-11 items-center gap-1 px-2 text-[15px] font-semibold text-live">
          <Plus size={18} aria-hidden />
          New
        </Link>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {loading && mine.length === 0 ? (
          <div className="h-[132px] animate-pulse rounded-lg bg-base-panel" aria-busy="true" aria-label="Loading routines" />
        ) : mine.length === 0 ? (
          <Link href="/m/workouts/routines/new" className="panel flex items-center gap-4 p-4 transition-colors active:bg-base-raised">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-live-tint text-live">
              <Plus size={22} aria-hidden />
            </span>
            <span>
              <span className="block text-[16px] font-semibold">Build your first routine</span>
              <span className="mt-0.5 block text-[13px] text-mute">Save the exercises you do, start them in one tap.</span>
            </span>
          </Link>
        ) : (
          mine.map(routine => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              note={notes.get(routine.id) ?? ''}
              onMenu={() => setMenu(routine)}
              onStart={() => begin(() => startWorkout(routine.name, routine.id, routine.entries))}
            />
          ))
        )}
      </div>

      {explore.length > 0 && (
        <>
          <h2 className="mt-9 text-2xl">Explore workouts</h2>
          <div className="no-scrollbar -mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-2.5 overflow-x-auto px-5 pb-1">
            {explore.map(routine => (
              <ExploreCard key={routine.id} routine={routine} cover={heroes.get(routine.id)} />
            ))}
          </div>
        </>
      )}

      <Link href="/m/workouts/exercises" className="row mt-8">
        <span className="flex-1 text-[15px] font-semibold">Exercise library</span>
        <span className="text-[13px] text-mute">How to do every move</span>
      </Link>

      {menu && (
        <ActionSheet
          title={menu.name}
          actions={[
            { label: 'Edit routine', icon: Pencil, onSelect: () => router.push(`/m/workouts/routines/${menu.id}`) },
            { label: 'Delete routine', icon: Trash2, tone: 'danger', onSelect: () => setDeleting(menu) },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
      {deleting && (
        <Dialog
          title="Delete routine?"
          body={`${deleting.name} will be removed. Workouts you logged with it stay in your history.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => removeRoutine(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      {replacing && (
        <Dialog
          title="Start a new workout?"
          body={`${session?.name ?? 'Your current workout'} is still running. Starting another discards it.`}
          confirmLabel="Discard and start"
          tone="danger"
          onConfirm={() => {
            replacing()
            router.push('/m/workouts/live')
          }}
          onClose={() => setReplacing(null)}
        />
      )}
    </div>
  )
}
