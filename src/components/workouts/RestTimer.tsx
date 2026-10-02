'use client'

import { useEffect, useRef } from 'react'
import { useWorkout } from '@/stores/workout'
import { useNow } from '@/hooks/useNow'
import { clock } from '@/lib/workouts'
import { playRestOver } from '@/lib/sounds'

const NUDGE_SECONDS = 15
const REST_OVER_BUZZ = [200, 100, 200]
const TICK_MS = 250

/** Floats over the bottom of the live workout while the member rests. */
export function RestTimer() {
  const { rest, nudgeRest, endRest } = useWorkout()
  const now = useNow(TICK_MS, rest !== null)
  const rang = useRef<number | null>(null)

  const left = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0

  useEffect(() => {
    if (!rest || left > 0 || rang.current === rest.endsAt) return
    rang.current = rest.endsAt
    // only ring for a screen that is being looked at; a hidden one was buzzed by the server
    if (document.visibilityState === 'visible') {
      playRestOver()
      navigator.vibrate?.(REST_OVER_BUZZ)
    }
    endRest()
  }, [rest, left, endRest])

  if (!rest || left <= 0) return null
  const progress = Math.min(1, Math.max(0, 1 - (rest.endsAt - now) / (rest.total * 1000)))

  return (
    <div
      role="timer"
      aria-label={`Rest, ${left} seconds left`}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-rise overflow-hidden rounded-xl bg-[#17171B] px-4 pb-3.5 pt-4 shadow-[0_-12px_40px_rgba(0,0,0,.65)]"
    >
      <p className="truncate text-[13px] font-medium text-mute">Next · {rest.label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="figure text-[46px]" aria-hidden>
          {clock(left)}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => nudgeRest(-NUDGE_SECONDS)}
            className="h-11 rounded-full bg-base-raised px-4 text-[14px] font-semibold tabular-nums active:scale-95"
          >
            −{NUDGE_SECONDS}
          </button>
          <button
            type="button"
            onClick={() => nudgeRest(NUDGE_SECONDS)}
            className="h-11 rounded-full bg-base-raised px-4 text-[14px] font-semibold tabular-nums active:scale-95"
          >
            +{NUDGE_SECONDS}
          </button>
          <button type="button" onClick={endRest} className="h-11 rounded-full bg-chalk px-5 text-[14px] font-semibold text-ink active:scale-95">
            Skip
          </button>
        </div>
      </div>
      <div className="mt-3.5 h-1 overflow-hidden rounded-full bg-base-raised">
        <div className="h-full rounded-full bg-live transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
