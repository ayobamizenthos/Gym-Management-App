'use client'

import { cn } from '@/lib/cn'
import type { CheckInKind } from '@/lib/types'

const PATHS: Record<CheckInKind, { d: string; length: number }> = {
  // a tick, drawn left to right
  valid: { d: 'M28 45 L40 57 L62 33', length: 62 },
  // a cross, drawn as one continuous gesture back and forth
  expired: { d: 'M32 32 L58 58 M58 32 L32 58', length: 74 },
  // an exclamation: stem then dot
  no_membership: { d: 'M45 28 L45 50 M45 60 L45 60.5', length: 24 },
  // a return arc
  duplicate: { d: 'M60 45 A15 15 0 1 1 45 30 M45 30 L45 22 M45 30 L37 30', length: 110 },
}

const TONE: Record<CheckInKind, string> = {
  valid: 'text-live',
  expired: 'text-out',
  no_membership: 'text-due',
  duplicate: 'text-chalk',
}

const GLOW: Record<CheckInKind, string> = {
  valid: 'bg-live',
  expired: 'bg-out',
  no_membership: 'bg-due',
  duplicate: 'bg-chalk',
}

/** The drawn status mark. Everything here is transform and opacity, so it stays
 *  on the compositor and cannot stutter on a mid-range phone. */
export function StatusMark({ kind }: { kind: CheckInKind }) {
  const path = PATHS[kind]

  return (
    <div className="relative grid h-[168px] w-[168px] place-items-center">
      {/* the bloom behind the mark */}
      <span
        aria-hidden
        className={cn('absolute h-[168px] w-[168px] rounded-full opacity-[0.14] blur-2xl animate-bloom', GLOW[kind])}
      />

      {/* one ring that expands away, like a reader pulse */}
      <span
        aria-hidden
        className={cn('absolute h-[120px] w-[120px] rounded-full border animate-pulse-out', TONE[kind], 'border-current')}
      />

      <svg viewBox="0 0 90 90" className={cn('relative h-[168px] w-[168px]', TONE[kind])} aria-hidden>
        {/* the containing circle traces itself first */}
        <circle
          cx="45" cy="45" r="40"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.28"
          pathLength={100}
          className="animate-trace"
        />
        <path
          d={path.d}
          fill="none" stroke="currentColor" strokeWidth="6"
          strokeLinecap="round" strokeLinejoin="round"
          pathLength={100}
          className="animate-draw"
        />
      </svg>
    </div>
  )
}
