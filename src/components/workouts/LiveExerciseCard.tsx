'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Check, Ellipsis, Plus, Repeat, Timer, Trash2 } from 'lucide-react'
import { ActionSheet } from '@/components/ActionSheet'
import type { SheetAction } from '@/components/ActionSheet'
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb'
import { useWorkout, setNumber, suggestion } from '@/stores/workout'
import type { LiveEntry } from '@/stores/workout'
import { isBodyweight } from '@/lib/exercises'
import type { Exercise } from '@/lib/exercises'
import { REST_CHOICES, restLabel } from '@/lib/workouts'
import type { PlannedSet } from '@/lib/workouts'
import { playSetDone } from '@/lib/sounds'
import { cn } from '@/lib/cn'

interface Props {
  entry: LiveEntry
  exercise: Exercise | undefined
  previous: PlannedSet[] | undefined
  first: boolean
  last: boolean
  /** "Set 2 of Incline Dumbbell Press": what the rest timer counts down to. */
  upNext: (entryKey: string, afterIndex: number) => { label: string; nextSet: number }
  onReplace: () => void
}

const TICK_BUZZ_MS = 12

const previousText = (set: PlannedSet | undefined, bodyweight: boolean) => {
  if (!set || set.reps === null) return '—'
  if (bodyweight || !set.kg) return `× ${set.reps}`
  return `${set.kg} × ${set.reps}`
}

const hintText = (value: number | null) => (value === null ? '' : String(value))

export function LiveExerciseCard({ entry, exercise, previous, first, last, upNext, onReplace }: Props) {
  const { editSet, toggleDone, addSet, removeSet, setKind, setRest, removeExercise, moveExercise, startRest } = useWorkout()
  const [menu, setMenu] = useState<'exercise' | 'rest' | { set: number } | null>(null)
  const [refused, setRefused] = useState<number | null>(null)
  const repsFields = useRef<(HTMLInputElement | null)[]>([])
  const bodyweight = isBodyweight(exercise)

  const tick = (index: number) => {
    const wasDone = entry.sets[index].done
    const completed = toggleDone(entry.key, index)
    if (wasDone) return
    if (!completed) {
      // no reps typed and nothing to borrow from: point at the field instead of guessing
      setRefused(index)
      repsFields.current[index]?.focus()
      window.setTimeout(() => setRefused(null), 400)
      return
    }
    playSetDone()
    navigator.vibrate?.(TICK_BUZZ_MS)
    if (entry.rest > 0) {
      const next = upNext(entry.key, index)
      startRest(entry.rest, entry.exerciseId, next.nextSet, next.label)
    }
  }

  const exerciseActions: SheetAction[] = [
    { label: `Rest timer · ${restLabel(entry.rest)}`, icon: Timer, onSelect: () => window.setTimeout(() => setMenu('rest'), 0) },
    { label: 'Replace exercise', icon: Repeat, onSelect: onReplace },
    ...(!first ? [{ label: 'Move up', icon: ArrowUp, onSelect: () => moveExercise(entry.key, -1) }] : []),
    ...(!last ? [{ label: 'Move down', icon: ArrowDown, onSelect: () => moveExercise(entry.key, 1) }] : []),
    { label: 'Remove exercise', icon: Trash2, tone: 'danger' as const, onSelect: () => removeExercise(entry.key) },
  ]

  return (
    <section aria-label={exercise?.name ?? 'Exercise'} className="pt-5">
      <div className="flex items-center gap-3">
        <Link href={`/m/workouts/exercises/${entry.exerciseId}`} className="shrink-0" aria-label={`About ${exercise?.name ?? 'this exercise'}`}>
          <ExerciseThumb id={entry.exerciseId} size={46} />
        </Link>
        <h3 className="min-w-0 flex-1 text-[17px] font-bold leading-tight">{exercise?.name ?? 'Loading…'}</h3>
        <button
          type="button"
          onClick={() => setMenu('exercise')}
          aria-label="Exercise options"
          className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-mute transition-colors active:bg-base-raised"
        >
          <Ellipsis size={22} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMenu('rest')}
        className="mt-1.5 flex h-9 items-center gap-1.5 text-[13px] font-semibold text-live"
      >
        <Timer size={16} aria-hidden />
        {entry.rest === 0 ? 'Rest timer off' : `Rest ${restLabel(entry.rest)}`}
      </button>

      <div
        role="table"
        aria-label="Sets"
        className={cn('mt-1 grid gap-y-1', bodyweight ? 'grid-cols-[42px_1fr_76px_48px]' : 'grid-cols-[42px_1fr_68px_68px_48px]')}
      >
        <div role="row" className="contents text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">
          <span role="columnheader" className="py-1 text-center">Set</span>
          <span role="columnheader" className="py-1 text-center">Previous</span>
          {!bodyweight && <span role="columnheader" className="py-1 text-center">Kg</span>}
          <span role="columnheader" className="py-1 text-center">Reps</span>
          <span role="columnheader" className="grid place-items-center py-1">
            <Check size={14} aria-label="Done" />
          </span>
        </div>

        {entry.sets.map((set, index) => {
          const hint = suggestion(entry, previous, index)
          const name = set.kind === 'warmup' ? 'Warm-up set' : `Set ${setNumber(entry.sets, index)}`
          const cell = cn('flex h-12 items-center justify-center', set.done && 'bg-live-tint')
          return (
            <div role="row" key={index} className={cn('contents', refused === index && '[&>*]:animate-nudge')}>
              <span role="cell" className={cn(cell, 'rounded-l-md')}>
                <button
                  type="button"
                  onClick={() => setMenu({ set: index })}
                  aria-label={`${name} options`}
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-md text-[15px] font-bold transition-colors active:bg-base-raised',
                    set.kind === 'warmup' ? 'text-due' : 'text-chalk'
                  )}
                >
                  {set.kind === 'warmup' ? 'W' : setNumber(entry.sets, index)}
                </button>
              </span>
              <span role="cell" className={cn(cell, 'text-[14px] font-medium tabular-nums text-mute')}>
                {previousText(previous?.[index], bodyweight)}
              </span>
              {!bodyweight && (
                <span role="cell" className={cell}>
                  <input
                    inputMode="decimal"
                    enterKeyHint="next"
                    aria-label={`${name} weight in kilograms`}
                    value={set.kg}
                    placeholder={hintText(hint.kg)}
                    onChange={event => editSet(entry.key, index, { kg: event.target.value.replace(/[^\d.,]/g, '').slice(0, 6) })}
                    onFocus={event => event.target.select()}
                    className={cn(
                      'h-9 w-[58px] rounded-sm bg-base-raised text-center text-[16px] font-semibold tabular-nums text-chalk outline-none transition-colors placeholder:text-mute/70 focus:ring-2 focus:ring-live',
                      set.done && 'bg-transparent'
                    )}
                  />
                </span>
              )}
              <span role="cell" className={cell}>
                <input
                  ref={node => {
                    repsFields.current[index] = node
                  }}
                  inputMode="numeric"
                  enterKeyHint="done"
                  aria-label={`${name} reps`}
                  value={set.reps}
                  placeholder={hintText(hint.reps)}
                  onChange={event => editSet(entry.key, index, { reps: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                  onFocus={event => event.target.select()}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                      tick(index)
                    }
                  }}
                  className={cn(
                    'h-9 w-[58px] rounded-sm bg-base-raised text-center text-[16px] font-semibold tabular-nums text-chalk outline-none transition-colors placeholder:text-mute/70 focus:ring-2 focus:ring-live',
                    set.done && 'bg-transparent'
                  )}
                />
              </span>
              <span role="cell" className={cn(cell, 'rounded-r-md')}>
                <button
                  type="button"
                  onClick={() => tick(index)}
                  aria-pressed={set.done}
                  aria-label={set.done ? `Undo ${name.toLowerCase()}` : `Complete ${name.toLowerCase()}`}
                  className="grid h-11 w-11 place-items-center"
                >
                  <span
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-sm transition-colors',
                      set.done ? 'animate-tick bg-live text-ink' : 'bg-base-raised text-mute'
                    )}
                  >
                    <Check size={18} strokeWidth={3} aria-hidden />
                  </span>
                </button>
              </span>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => addSet(entry.key)}
        className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-base-panel text-[14px] font-semibold text-chalk-dim transition-colors active:bg-base-raised"
      >
        <Plus size={16} aria-hidden />
        Add set
      </button>

      {menu === 'exercise' && <ActionSheet title={exercise?.name} actions={exerciseActions} onClose={() => setMenu(null)} />}

      {menu === 'rest' && (
        <ActionSheet
          title="Rest after each set"
          actions={REST_CHOICES.map(seconds => ({
            label: seconds === 0 ? 'No rest timer' : restLabel(seconds),
            chosen: seconds === entry.rest,
            onSelect: () => setRest(entry.key, seconds),
          }))}
          onClose={() => setMenu(null)}
        />
      )}

      {menu !== null && typeof menu === 'object' && (
        <ActionSheet
          title={entry.sets[menu.set]?.kind === 'warmup' ? 'Warm-up set' : `Set ${setNumber(entry.sets, menu.set)}`}
          actions={[
            { label: 'Warm-up set', chosen: entry.sets[menu.set]?.kind === 'warmup', onSelect: () => setKind(entry.key, menu.set, 'warmup') },
            { label: 'Working set', chosen: entry.sets[menu.set]?.kind === 'normal', onSelect: () => setKind(entry.key, menu.set, 'normal') },
            { label: 'Remove set', icon: Trash2, tone: 'danger', onSelect: () => removeSet(entry.key, menu.set) },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </section>
  )
}
