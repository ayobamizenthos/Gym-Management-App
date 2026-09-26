'use client'

import { cn } from '@/lib/cn'
import type { CheckInKind } from '@/lib/types'

const PATHS: Record<CheckInKind, string> = {
  valid: 'M28 45 L40 57 L62 33',
  expired: 'M32 32 L58 58 M58 32 L32 58',
  no_membership: 'M45 28 L45 50 M45 60 L45 60.5',
  duplicate: 'M60 45 A15 15 0 1 1 45 30 M45 30 L45 22 M45 30 L37 30',
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

/** The check-in outcome drawn as a ring and a stroked mark. */
export function StatusMark({ kind }: { kind: CheckInKind }) {
  return (
    <div className="relative grid h-[168px] w-[168px] place-items-center">
      <span
        aria-hidden
        className={cn('absolute h-[168px] w-[168px] rounded-full opacity-[0.14] blur-2xl animate-bloom', GLOW[kind])}
      />

      <span
        aria-hidden
        className={cn('absolute h-[120px] w-[120px] rounded-full border animate-pulse-out', TONE[kind], 'border-current')}
      />

      <svg viewBox="0 0 90 90" className={cn('relative h-[168px] w-[168px]', TONE[kind])} aria-hidden>
        <circle
          cx="45" cy="45" r="40"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.28"
          pathLength={100}
          className="animate-trace"
        />
        <path
          d={PATHS[kind]}
          fill="none" stroke="currentColor" strokeWidth="6"
          strokeLinecap="round" strokeLinejoin="round"
          pathLength={100}
          className="animate-draw"
        />
      </svg>
    </div>
  )
}
