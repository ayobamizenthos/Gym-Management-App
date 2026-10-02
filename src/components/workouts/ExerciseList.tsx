'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Search, SearchX, X } from 'lucide-react'
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb'
import { MUSCLE_GROUPS, exerciseCaption, searchExercises, useExercises } from '@/lib/exercises'
import type { Exercise } from '@/lib/exercises'
import { cn } from '@/lib/cn'

// Rows are drawn in pages as the list scrolls; 1,283 animations at once would stall a phone.
const PAGE = 30
const SKELETONS = 8

interface Props {
  /** Picking marks rows; browsing links each row to its page. */
  mode: 'pick' | 'browse'
  selected?: string[]
  onToggle?: (id: string) => void
  /** Shown first, under "Recent", while nothing is typed or filtered. */
  recent?: string[]
  autoFocus?: boolean
}

function Row({ exercise, mode, picked, onToggle }: { exercise: Exercise; mode: Props['mode']; picked: boolean; onToggle?: (id: string) => void }) {
  const body = (
    <>
      {picked && <span aria-hidden className="absolute -left-5 bottom-3 top-3 w-[3px] rounded-full bg-live" />}
      <ExerciseThumb id={exercise.id} size={56} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{exercise.name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-mute">{exerciseCaption(exercise)}</span>
      </span>
      {mode === 'pick' ? (
        <span
          aria-hidden
          className={cn(
            'grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full transition-colors',
            picked ? 'animate-tick bg-live text-ink' : 'shadow-[inset_0_0_0_2px_#3a3a42]'
          )}
        >
          {picked && <Check size={16} strokeWidth={3} />}
        </span>
      ) : (
        <ChevronRight size={18} aria-hidden className="shrink-0 text-mute" />
      )}
    </>
  )
  const row = 'relative flex w-full items-center gap-3.5 py-2 text-left'
  return mode === 'pick' ? (
    <button type="button" aria-pressed={picked} onClick={() => onToggle?.(exercise.id)} className={row}>
      {body}
    </button>
  ) : (
    <Link href={`/m/workouts/exercises/${exercise.id}`} className={row}>
      {body}
    </Link>
  )
}

export function ExerciseList({ mode, selected = [], onToggle, recent = [], autoFocus = false }: Props) {
  const { exercises, byId, loading } = useExercises()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const typed = useDeferredValue(query)
  const sentinel = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => searchExercises(exercises, typed, group), [exercises, typed, group])
  const filtering = typed.trim() !== '' || group !== null
  const recentRows = useMemo(
    () => (filtering ? [] : recent.map(id => byId.get(id)).filter((item): item is Exercise => Boolean(item))),
    [filtering, recent, byId]
  )

  useEffect(() => setShown(PAGE), [typed, group])

  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const watcher = new IntersectionObserver(seen => {
      if (seen[0]?.isIntersecting) setShown(count => count + PAGE)
    }, { rootMargin: '600px' })
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [matches.length])

  const picked = new Set(selected)

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search exercises</span>
        <Search size={19} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={event => setQuery(event.target.value)}
          placeholder={exercises.length ? `Search ${exercises.length.toLocaleString('en-NG')} exercises` : 'Search exercises'}
          className="field pl-11 pr-11 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-mute"
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </label>

      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        {[{ key: null, label: 'All' }, ...MUSCLE_GROUPS].map(option => (
          <button
            key={option.label}
            type="button"
            aria-pressed={group === option.key}
            onClick={() => setGroup(option.key)}
            className={group === option.key ? 'seg-on h-9' : 'seg-off h-9 bg-base-panel text-chalk'}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && exercises.length === 0 ? (
        <div className="mt-5 flex flex-col gap-3" aria-busy="true" aria-label="Loading exercises">
          {Array.from({ length: SKELETONS }).map((_, index) => (
            <div key={index} className="flex items-center gap-3.5">
              <span className="h-14 w-14 animate-pulse rounded-[12px] bg-base-panel" />
              <span className="h-4 w-1/2 animate-pulse rounded bg-base-panel" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {recentRows.length > 0 && (
            <>
              <p className="label mb-1 mt-5">Recent</p>
              {recentRows.map(exercise => (
                <Row key={'recent-' + exercise.id} exercise={exercise} mode={mode} picked={picked.has(exercise.id)} onToggle={onToggle} />
              ))}
            </>
          )}

          <p className="label mb-1 mt-5">
            {filtering ? `${matches.length.toLocaleString('en-NG')} ${matches.length === 1 ? 'exercise' : 'exercises'}` : 'All exercises'}
          </p>
          {matches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-base-panel">
                <SearchX size={24} className="text-mute" aria-hidden />
              </span>
              <p className="max-w-[16rem] text-[15px] text-mute">
                {typed.trim() ? `Nothing matches “${typed.trim()}”. Try a muscle or a machine.` : 'No exercises in this group yet.'}
              </p>
            </div>
          ) : (
            matches.slice(0, shown).map(exercise => (
              <Row key={exercise.id} exercise={exercise} mode={mode} picked={picked.has(exercise.id)} onToggle={onToggle} />
            ))
          )}
          {shown < matches.length && <div ref={sentinel} className="h-px" />}
        </>
      )}
    </div>
  )
}
