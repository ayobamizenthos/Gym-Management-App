'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb'
import { ProgressChart } from '@/components/workouts/ProgressChart'
import { useAuth } from '@/stores/auth'
import { useCached } from '@/hooks/useCached'
import { supabase } from '@/lib/supabase'
import { equipmentLabel, isBodyweight, muscleLabel } from '@/lib/exercises'
import type { ExerciseDetail } from '@/lib/exercises'
import { kgLabel } from '@/lib/workouts'
import type { PlannedSet, Workout } from '@/lib/workouts'
import { cn } from '@/lib/cn'

interface BestRecord {
  best_kg: number
  best_kg_reps: number
  best_reps: number
  best_1rm: number
}

type Tab = 'progress' | 'how' | 'history'

const SESSIONS = 40

function setLine(set: PlannedSet, bodyweight: boolean) {
  const reps = `${set.reps ?? 0} ${set.reps === 1 ? 'rep' : 'reps'}`
  return bodyweight || !set.kg ? reps : `${kgLabel(set.kg)} × ${set.reps ?? 0}`
}

export default function ExercisePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab | null>(null)

  const { data: exercise } = useCached<ExerciseDetail | null>(`exercise:${id}`, async () => {
    const { data } = await supabase.from('exercises').select('*').eq('id', id).maybeSingle()
    return (data as ExerciseDetail | null) ?? null
  })

  const { data: sessions, settled } = useCached<Workout[]>(`exercise-history:${profile?.id ?? 'none'}:${id}`, async () => {
    if (!profile) return []
    const { data } = await supabase
      .from('workouts')
      .select('id, name, started_at, ended_at, entries')
      .eq('user_id', profile.id)
      // jsonb containment wants the JSON text; an array of objects is mis-encoded as a Postgres array
      .contains('entries', JSON.stringify([{ exercise_id: id }]))
      .order('ended_at', { ascending: false })
      .limit(SESSIONS)
    return (data ?? []) as Workout[]
  })

  const { data: record } = useCached<BestRecord | null>(`record:${profile?.id ?? 'none'}:${id}`, async () => {
    if (!profile) return null
    const { data } = await supabase
      .from('personal_records')
      .select('best_kg, best_kg_reps, best_reps, best_1rm')
      .eq('user_id', profile.id)
      .eq('exercise_id', id)
      .maybeSingle()
    return (data as BestRecord | null) ?? null
  })

  const bodyweight = isBodyweight(exercise ?? undefined)
  const history = useMemo(
    () =>
      (sessions ?? []).map(workout => ({
        workout,
        sets: workout.entries.filter(entry => entry.exercise_id === id).flatMap(entry => entry.sets),
      })),
    [sessions, id]
  )

  const points = useMemo(
    () =>
      [...history].reverse().map(({ workout, sets }) => ({
        at: workout.ended_at,
        value: Math.max(0, ...sets.filter(set => set.kind === 'normal').map(set => (bodyweight ? set.reps ?? 0 : set.kg ?? 0))),
      })),
    [history, bodyweight]
  )

  // land on Progress once there is something to show, otherwise on How to
  useEffect(() => {
    if (tab === null && settled) setTab(history.length > 0 ? 'progress' : 'how')
  }, [tab, settled, history.length])

  const shown = tab ?? 'how'
  const first = points[0]?.value ?? 0
  const best = Math.max(0, ...points.map(point => point.value))
  const gain = best - first

  return (
    <div className="animate-rise pb-6">
      <button type="button" onClick={() => router.back()} aria-label="Back" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-base-raised">
        <ChevronLeft size={26} aria-hidden />
      </button>

      <ExerciseThumb id={id} size="fill" eager className="mx-auto mt-2 max-w-[300px]" />

      <h1 className="mt-5 text-[34px]">{exercise?.name ?? ' '}</h1>
      {exercise && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="seg h-9 bg-live-tint text-live">{muscleLabel(exercise.target)}</span>
          {exercise.secondary.slice(0, 2).map(muscle => (
            <span key={muscle} className="seg h-9 bg-base-panel text-chalk">{muscleLabel(muscle)}</span>
          ))}
          <span className="seg h-9 bg-base-panel text-chalk">{equipmentLabel(exercise.equipment)}</span>
        </div>
      )}

      <div role="tablist" className="mt-6 grid grid-cols-3 gap-1 rounded-full bg-base-panel p-1">
        {(
          [
            ['progress', 'Progress'],
            ['how', 'How to'],
            ['history', 'History'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={shown === key} onClick={() => setTab(key)} className={cn('justify-center', shown === key ? 'seg-on' : 'seg-off')}>
            {label}
          </button>
        ))}
      </div>

      {shown === 'how' && (
        <ol className="mt-5 flex flex-col gap-4">
          {(exercise?.steps ?? []).map((step, index) => (
            <li key={index} className="flex gap-3.5">
              <span className="figure grid h-7 w-7 shrink-0 place-items-center rounded-full bg-base-panel text-[15px] text-live">{index + 1}</span>
              <p className="pt-0.5 text-[15px] leading-relaxed text-chalk-dim">{step}</p>
            </li>
          ))}
        </ol>
      )}

      {shown === 'progress' &&
        (points.length === 0 ? (
          <p className="mt-6 text-[15px] text-mute">Log this exercise in a workout and your progress shows up here.</p>
        ) : (
          <>
            <div className="panel mt-4 p-4">
              <p className="label">{bodyweight ? 'Most reps in a set' : 'Heaviest weight'}</p>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span className="figure text-[34px]">{bodyweight ? best : kgLabel(best)}</span>
                {gain > 0 && <span className="text-[13px] font-semibold text-live">+{bodyweight ? gain : kgLabel(gain)}</span>}
              </p>
              {points.length > 1 ? (
                <ProgressChart points={points} label={bodyweight ? 'Most reps per workout' : 'Heaviest weight per workout'} />
              ) : (
                <p className="mt-2 text-[14px] text-mute">Log it once more to see your trend.</p>
              )}
            </div>
            {record && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="panel p-4">
                  <p className="label">Best set</p>
                  <p className="figure mt-1.5 text-[24px]">
                    {bodyweight || record.best_kg === 0 ? `${record.best_reps} reps` : `${record.best_kg} × ${record.best_kg_reps}`}
                  </p>
                </div>
                <div className="panel p-4">
                  <p className="label">{bodyweight || record.best_1rm === 0 ? 'Workouts' : 'Est. one-rep max'}</p>
                  <p className="figure mt-1.5 text-[24px]">{bodyweight || record.best_1rm === 0 ? history.length : kgLabel(Math.round(record.best_1rm))}</p>
                </div>
              </div>
            )}
          </>
        ))}

      {shown === 'history' &&
        (history.length === 0 ? (
          <p className="mt-6 text-[15px] text-mute">No workouts with this exercise yet.</p>
        ) : (
          <ul role="list" className="mt-4 flex flex-col gap-2.5">
            {history.map(({ workout, sets }) => (
              <li key={workout.id}>
                <Link href={`/m/workouts/history/${workout.id}`} className="panel block p-4 active:bg-base-raised">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-semibold">{workout.name}</span>
                    <span className="shrink-0 text-[13px] text-mute">
                      {new Date(workout.ended_at).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <span className="mt-2 flex flex-col gap-1">
                    {sets.map((set, index) => (
                      <span key={index} className="text-[14px] tabular-nums text-chalk-dim">
                        <span className={cn('inline-block w-6 font-semibold', set.kind === 'warmup' ? 'text-due' : 'text-mute')}>
                          {set.kind === 'warmup' ? 'W' : sets.slice(0, index + 1).filter(item => item.kind === 'normal').length}
                        </span>
                        {setLine(set, bodyweight)}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
