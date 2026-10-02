'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Medal, RotateCcw, Share } from 'lucide-react'
import { Confetti } from '@/components/workouts/Confetti'
import { ShareSheet } from '@/components/workouts/ShareSheet'
import { TrophyMark } from '@/components/workouts/TrophyMark'
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb'
import { Dialog } from '@/components/Dialog'
import { useExercises, isBodyweight } from '@/lib/exercises'
import { clock, kgLabel, secondsBetween, spoken } from '@/lib/workouts'
import type { FinishResult, PersonalBest, Workout } from '@/lib/workouts'
import { startWorkout } from '@/lib/workout-session'
import { playWorkoutDone } from '@/lib/sounds'
import { useWorkout } from '@/stores/workout'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'

const COUNT_MS = 900
const COUNT_DELAY_MS = 650
const CELEBRATE_BUZZ = [30, 60, 30, 60, 140]
const TROPHY_LAND_MS = 420
const STREAK_DOTS = 8

function ordinal(n: number) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** Counts up from zero once, eased out, so the numbers land rather than appear. */
function useCountUp(target: number, run: boolean) {
  const [value, setValue] = useState(run ? 0 : target)
  useEffect(() => {
    if (!run || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame = 0
    let started = 0
    const tick = (time: number) => {
      if (!started) started = time
      const t = Math.min(1, (time - started) / COUNT_MS)
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    const timer = window.setTimeout(() => (frame = requestAnimationFrame(tick)), COUNT_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [target, run])
  return value
}

function recordText(record: PersonalBest) {
  if (record.kind === 'reps') return `${record.reps} reps`
  return `${kgLabel(record.kg ?? 0)} × ${record.reps}`
}

interface Props {
  workout: Workout
  /** Present only straight after Finish: turns the summary into the celebration. */
  result: FinishResult | null
}

export function WorkoutSummary({ workout, result }: Props) {
  const router = useRouter()
  const { byId } = useExercises()
  const session = useWorkout(state => state.session)
  const trophy = useRef<HTMLSpanElement>(null)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const celebrate = result !== null

  const seconds = secondsBetween(workout.started_at, workout.ended_at)
  const minutes = useCountUp(seconds, celebrate)
  const volume = useCountUp(Number(workout.volume_kg), celebrate)
  const sets = useCountUp(workout.set_count, celebrate)
  const records = workout.records ?? []

  useEffect(() => {
    if (!celebrate) return
    const box = trophy.current?.getBoundingClientRect()
    if (box) setOrigin({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    const timer = window.setTimeout(() => {
      playWorkoutDone()
      navigator.vibrate?.(CELEBRATE_BUZZ)
    }, TROPHY_LAND_MS)
    return () => window.clearTimeout(timer)
  }, [celebrate])

  // the result stays in memory until the next workout begins; clearing it here would
  // make the done page redirect to the plain summary before this navigation lands
  const done = () => router.replace('/m/workouts')

  const repeat = () => {
    startWorkout(workout.name, workout.routine_id, workout.entries)
    router.push('/m/workouts/live')
  }

  const ended = new Date(workout.ended_at)

  return (
    <div className={cn('relative', celebrate ? 'pb-36' : 'pb-8')}>
      {celebrate && origin && <Confetti originX={origin.x} originY={origin.y} delayMs={TROPHY_LAND_MS - 60} />}

      {celebrate ? (
        <>
          {/* clipped to the column: a glow wider than the phone would let the page scroll sideways */}
          <div aria-hidden className="pointer-events-none absolute -inset-x-5 top-0 h-[560px] overflow-hidden">
            <div className="absolute left-1/2 top-16 -ml-[210px] h-[420px] w-[420px] animate-bloom rounded-full bg-[radial-gradient(circle,rgba(53,208,127,.9),transparent_65%)]" />
          </div>
          <div className="relative flex flex-col items-center pt-12 text-center">
            <span className="relative grid h-24 w-24 place-items-center">
              <span aria-hidden className="absolute inset-0 animate-ring rounded-full border-2 border-[#F7B733]" />
              <span ref={trophy} className="grid h-24 w-24 animate-trophy place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(247,183,51,.28),rgba(247,183,51,.08)_70%)] shadow-[0_0_0_2px_rgba(247,183,51,.45),0_18px_50px_-10px_rgba(247,183,51,.55)]">
                <TrophyMark size={64} />
              </span>
            </span>
            <h1 className="mt-7 animate-slam text-[54px]">Workout done</h1>
            <p className="mt-3 animate-lift-1 text-[16px] text-mute">
              {workout.name} · your {ordinal(result.ordinal)} workout
            </p>
          </div>
        </>
      ) : (
        <>
          <Link href="/m/workouts/progress" aria-label="Back to progress" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-base-raised">
            <ChevronLeft size={26} aria-hidden />
          </Link>
          <h1 className="mt-2 text-[40px]">{workout.name}</h1>
          <p className="mt-2 text-[15px] text-mute">
            {ended.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
            {ended.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
        </>
      )}

      <dl className={cn('relative mt-8 grid grid-cols-3 gap-2.5', celebrate && 'animate-lift-1')}>
        {[
          { label: 'Duration', value: celebrate ? clock(minutes) : spoken(seconds) },
          { label: 'kg lifted', value: Math.round(volume).toLocaleString('en-NG') },
          { label: plural(Math.round(sets), 'Set'), value: String(Math.round(sets)) },
        ].map(stat => (
          <div key={stat.label} className="panel flex flex-col-reverse px-2 py-4 text-center">
            <dt className="label mt-1.5">{stat.label}</dt>
            <dd className="figure text-[26px] tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {records.length > 0 && (
        <section className={cn('panel relative mt-2.5 p-4', celebrate && 'animate-lift-2')}>
          <h2 className="flex items-center gap-2 font-body text-[15px] font-bold normal-case tracking-normal">
            <Medal size={19} className="text-due" aria-hidden />
            {records.length} new {plural(records.length, 'personal best')}
          </h2>
          <ul role="list" className="mt-3 flex flex-col gap-3">
            {records.map(record => {
              const exercise = byId.get(record.exercise_id)
              return (
                <li key={record.exercise_id} className="flex items-center gap-3">
                  <ExerciseThumb id={record.exercise_id} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{exercise?.name ?? '…'}</span>
                    <span className="block text-[13px] text-mute">{record.kind === 'weight' ? 'Heaviest weight' : 'Most reps'}</span>
                  </span>
                  <span className="figure text-[20px]">{recordText(record)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {celebrate && (
        <ul role="list" className="panel relative mt-2.5 flex animate-lift-2 flex-col gap-3 p-4">
          {workout.entries.map((entry, index) => {
            const exercise = byId.get(entry.exercise_id)
            const working = entry.sets.filter(set => set.kind === 'normal')
            const top = [...(working.length ? working : entry.sets)].sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0]
            return (
              <li key={entry.exercise_id + index} className="flex items-center gap-3">
                <ExerciseThumb id={entry.exercise_id} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{exercise?.name ?? '…'}</span>
                  <span className="block text-[13px] text-mute">
                    {entry.sets.length} {plural(entry.sets.length, 'set')}
                    {top && ` · best ${isBodyweight(exercise) || !top.kg ? `${top.reps} reps` : `${kgLabel(top.kg)} × ${top.reps}`}`}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {celebrate && result.streak_weeks > 1 && (
        <div className="panel relative mt-2.5 flex animate-lift-3 items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[15px] font-semibold">{result.streak_weeks} weeks in a row</span>
          <span className="flex gap-1.5" aria-hidden>
            {Array.from({ length: Math.min(result.streak_weeks, STREAK_DOTS) }).map((_, index) => (
              <span key={index} className="h-1.5 w-5 rounded-full bg-live" />
            ))}
          </span>
        </div>
      )}

      {!celebrate && (
        <section className="mt-8">
          <h2 className="text-2xl">Exercises</h2>
          <ul role="list" className="mt-3 flex flex-col gap-2.5">
            {workout.entries.map((entry, index) => {
              const exercise = byId.get(entry.exercise_id)
              const bodyweight = isBodyweight(exercise)
              return (
                <li key={entry.exercise_id + index} className="panel p-4">
                  <Link href={`/m/workouts/exercises/${entry.exercise_id}`} className="flex items-center gap-3">
                    <ExerciseThumb id={entry.exercise_id} size={44} />
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{exercise?.name ?? '…'}</span>
                  </Link>
                  <ol className="mt-3 flex flex-col gap-1.5">
                    {entry.sets.map((set, at) => (
                      <li key={at} className="flex text-[14px] tabular-nums text-chalk-dim">
                        <span className={cn('w-7 font-semibold', set.kind === 'warmup' ? 'text-due' : 'text-mute')}>
                          {set.kind === 'warmup' ? 'W' : entry.sets.slice(0, at + 1).filter(item => item.kind === 'normal').length}
                        </span>
                        {bodyweight || !set.kg ? `${set.reps} reps` : `${kgLabel(set.kg)} × ${set.reps}`}
                      </li>
                    ))}
                  </ol>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex gap-2.5">
            <button type="button" onClick={() => setSharing(true)} className="btn-quiet flex-1">
              <Share size={18} aria-hidden />
              Share
            </button>
            <button type="button" onClick={() => (session ? setReplacing(true) : repeat())} className="btn-quiet flex-[1.6]">
              <RotateCcw size={18} aria-hidden />
              Do it again
            </button>
          </div>
        </section>
      )}

      {celebrate && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-base via-base/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
          <div className="mx-auto flex max-w-md animate-lift-3 gap-2.5">
            <button type="button" onClick={() => setSharing(true)} className="btn-quiet flex-1">
              <Share size={18} aria-hidden />
              Share
            </button>
            <button type="button" onClick={done} className="btn-primary flex-[2]">
              Done
            </button>
          </div>
        </div>
      )}

      {sharing && (
        <ShareSheet
          workout={workout}
          ordinal={result?.ordinal ?? null}
          streakWeeks={result?.streak_weeks ?? null}
          onClose={() => setSharing(false)}
        />
      )}

      {replacing && (
        <Dialog
          title="Start a new workout?"
          body={`${session?.name ?? 'Your current workout'} is still running. Starting another discards it.`}
          confirmLabel="Discard and start"
          tone="danger"
          onConfirm={repeat}
          onClose={() => setReplacing(false)}
        />
      )}
    </div>
  )
}
