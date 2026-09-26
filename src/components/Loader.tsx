'use client'

import { Wordmark } from '@/components/Wordmark'
import { cn } from '@/lib/cn'

export function Loader({ full, label }: { full?: boolean; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn(
        'grid place-items-center',
        full ? 'fixed inset-0 z-[80] bg-base' : 'py-20'
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <span aria-hidden className="font-display text-3xl uppercase tracking-tightest text-chalk">
          <Wordmark />
        </span>
        <span aria-hidden className="relative block h-[3px] w-40 overflow-hidden bg-edge">
          <span className="absolute inset-y-0 w-1/2 animate-sweep bg-live" />
        </span>
        {label && <span className="text-sm text-mute">{label}</span>}
      </div>
    </div>
  )
}
