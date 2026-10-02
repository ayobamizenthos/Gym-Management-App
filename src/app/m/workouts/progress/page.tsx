'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock3, Medal, Weight } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { dayKey, secondsBetween, spoken, useWorkoutHistory, volumeLabel } from '@/lib/workouts'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const RECENT = 20

export default function ProgressPage() {
  const { profile } = useAuth()
  const { workouts, loading } = useWorkoutHistory(profile?.id)
  const [offset, setOffset] = useState(0)

  const month = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + offset, 1)
  }, [offset])

  const trained = useMemo(() => new Set(workouts.map(workout => dayKey(new Date(workout.ended_at)))), [workouts])
  const inMonth = workouts.filter(workout => {
    const at = new Date(workout.ended_at)
    return at.getFullYear() === month.getFullYear() && at.getMonth() === month.getMonth()
  })

  const lead = (month.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const today = dayKey(new Date())
  const oldest = workouts[workouts.length - 1]
  const canGoBack = oldest ? new Date(oldest.ended_at) < month : false

  return (
    <div className="animate-rise">
      <Link href="/m/workouts" aria-label="Back to workouts" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-base-raised">
        <ChevronLeft size={26} aria-hidden />
      </Link>
      <h1 className="mt-2 text-[44px]">Progress</h1>

      <section className="panel mt-5 p-4" aria-label="Training calendar">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOffset(value => value - 1)}
            disabled={!canGoBack}
            aria-label="Previous month"
            className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-mute active:bg-base-raised disabled:opacity-25"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <p className="text-center">
            <span className="block text-[15px] font-semibold">{month.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}</span>
            <span className="block text-[13px] text-mute">
              {inMonth.length} {plural(inMonth.length, 'workout')}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOffset(value => value + 1)}
            disabled={offset === 0}
            aria-label="Next month"
            className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-mute active:bg-base-raised disabled:opacity-25"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS.map((letter, index) => (
            <span key={index} className="pb-1 text-[11px] font-semibold text-mute">{letter}</span>
          ))}
          {Array.from({ length: lead }).map((_, index) => (
            <span key={'lead' + index} />
          ))}
          {Array.from({ length: days }).map((_, index) => {
            const key = dayKey(new Date(month.getFullYear(), month.getMonth(), index + 1))
            const done = trained.has(key)
            return (
              <span
                key={key}
                className={cn(
                  'grid h-9 place-items-center rounded-[10px] text-[13px] font-semibold tabular-nums',
                  done ? 'bg-live-tint text-live' : 'text-mute',
                  key === today && 'ring-2 ring-inset ring-chalk text-chalk'
                )}
              >
                {index + 1}
              </span>
            )
          })}
        </div>
      </section>

      <h2 className="mt-8 text-2xl">Recent</h2>
      {loading && workouts.length === 0 ? (
        <div className="mt-3 h-[84px] animate-pulse rounded-lg bg-base-panel" aria-busy="true" aria-label="Loading workouts" />
      ) : workouts.length === 0 ? (
        <p className="mt-3 text-[15px] text-mute">Finish a workout and it lands here, with every set and personal best.</p>
      ) : (
        <ul role="list" className="mt-3 flex flex-col gap-2.5">
          {workouts.slice(0, RECENT).map(workout => (
            <li key={workout.id}>
              <Link href={`/m/workouts/history/${workout.id}`} className="panel block px-4 py-3.5 transition-colors active:bg-base-raised">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[16px] font-bold">{workout.name}</span>
                  <span className="shrink-0 text-[13px] text-mute">
                    {new Date(workout.ended_at).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-chalk-dim">
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={15} className="text-mute" aria-hidden />
                    {spoken(secondsBetween(workout.started_at, workout.ended_at))}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Weight size={15} className="text-mute" aria-hidden />
                    {volumeLabel(Number(workout.volume_kg))}
                  </span>
                  {workout.records.length > 0 && (
                    <span className="flex items-center gap-1.5 text-due">
                      <Medal size={15} aria-hidden />
                      {workout.records.length} {plural(workout.records.length, 'best')}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
