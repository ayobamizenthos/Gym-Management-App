import { cn } from '@/lib/cn'

/** Brand loader. A single sweeping bar - no spinners, no skeleton grids. */
export function Loader({ full, label }: { full?: boolean; label?: string }) {
  return (
    <div className={cn('grid place-items-center', full ? 'min-h-dvh' : 'py-20')}>
      <div className="flex flex-col items-center gap-5">
        <span className="font-display text-3xl uppercase tracking-tightest text-ink">
          Zenthos<span className="text-good">Gym</span>
        </span>
        <span className="relative block h-[3px] w-40 overflow-hidden bg-line">
          <span className="absolute inset-y-0 w-1/2 animate-sweep bg-good" />
        </span>
        {label && <span className="text-sm text-mute">{label}</span>}
      </div>
    </div>
  )
}
