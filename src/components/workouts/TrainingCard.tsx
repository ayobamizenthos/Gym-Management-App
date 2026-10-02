'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { dayKey, startOfWeek, useWorkoutHistory } from '@/lib/workouts'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'

const DAYS_IN_WEEK = 7

/** The home screen's way into Workouts: this week at a glance, free whatever the plan. */
export function TrainingCard({ userId }: { userId: string | undefined }) {
  const { workouts } = useWorkoutHistory(userId)
  const monday = startOfWeek(new Date())
  const trained = new Set(workouts.filter(workout => new Date(workout.ended_at) >= monday).map(workout => dayKey(new Date(workout.ended_at))))

  return (
    <Link href="/m/workouts" className="panel mt-8 block p-5 transition-colors hover:bg-base-raised">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl">Your training</h2>
          <p className="mt-1.5 text-[15px] text-chalk-dim">
            {trained.size > 0
              ? `${trained.size} ${plural(trained.size, 'day')} trained this week. Keep it going.`
              : 'Log every set, follow ready-made workouts and watch your lifts climb. Free for members.'}
          </p>
        </div>
        <ArrowRight size={20} className="mt-1 shrink-0 text-mute" aria-hidden />
      </div>
      <div className="mt-5 flex gap-1.5" role="img" aria-label={`${trained.size} of ${DAYS_IN_WEEK} days trained this week`}>
        {Array.from({ length: DAYS_IN_WEEK }).map((_, index) => {
          const day = new Date(monday)
          day.setDate(monday.getDate() + index)
          return <span key={index} className={cn('h-1 flex-1 rounded-full', trained.has(dayKey(day)) ? 'bg-live' : 'bg-edge')} />
        })}
      </div>
    </Link>
  )
}
