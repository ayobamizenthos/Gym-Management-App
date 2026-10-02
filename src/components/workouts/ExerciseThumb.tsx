'use client'

import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { exerciseGif } from '@/lib/exercises'
import { cn } from '@/lib/cn'

interface Props {
  id: string
  /** Rendered size in pixels, or the full width of its container. */
  size: number | 'fill'
  className?: string
  /** Large views load at once; list rows wait until they scroll near. */
  eager?: boolean
}

/**
 * The animations are drawn on white, so they sit on a white tile rather than
 * fighting the dark UI. Until one arrives the tile breathes, and if it never
 * does a dumbbell stands in, so a slow connection never leaves blank squares.
 */
export function ExerciseThumb({ id, size, className, eager = false }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [shown, setShown] = useState(id)
  if (shown !== id) {
    // a replaced exercise starts loading afresh
    setShown(id)
    setState('loading')
  }
  const fill = size === 'fill'

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden shadow-[inset_0_0_0_1px_rgb(0_0_0/.06)] transition-colors',
        state === 'failed' ? 'bg-base-raised' : 'bg-white',
        fill ? 'aspect-square w-full rounded-xl' : size >= 120 ? 'rounded-lg' : 'rounded-[12px]',
        className
      )}
      style={fill ? undefined : { width: size, height: size }}
    >
      {state === 'loading' && <span aria-hidden className="absolute inset-0 animate-pulse bg-[#ececec]" />}
      {state === 'failed' ? (
        <Dumbbell size={fill ? 48 : Math.max(16, size * 0.4)} className="text-mute" aria-hidden />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- animated GIFs from the exercise CDN; resizing would freeze them
        <img
          key={id}
          src={exerciseGif(id)}
          alt=""
          width={fill ? 360 : size}
          height={fill ? 360 : size}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          // a cached image can finish before React attaches onLoad
          ref={node => {
            if (node?.complete && node.naturalWidth > 0 && state === 'loading') setState('ready')
          }}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
          className={cn('relative h-[90%] w-[90%] object-contain transition-opacity duration-300', state === 'ready' ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </span>
  )
}
