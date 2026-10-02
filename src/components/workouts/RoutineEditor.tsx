'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Dumbbell, Ellipsis, Plus, Timer, Trash2, X } from 'lucide-react'
import { ActionSheet } from '@/components/ActionSheet'
import { Dialog } from '@/components/Dialog'
import { ExercisePicker } from '@/components/workouts/ExercisePicker'
import { ExerciseThumb } from '@/components/workouts/ExerciseThumb'
import { isBodyweight, useExercises } from '@/lib/exercises'
import { DEFAULT_REST_SECONDS, REST_CHOICES, restLabel } from '@/lib/workouts'
import type { Routine, RoutineEntry, SetKind } from '@/lib/workouts'
import { setNumber } from '@/stores/workout'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { cn } from '@/lib/cn'

interface DraftSet {
  kind: SetKind
  kg: string
  reps: string
}

interface DraftEntry {
  key: string
  exerciseId: string
  rest: number
  sets: DraftSet[]
}

const NAME_LIMIT = 60
const DEFAULT_REPS = '10'

let counter = 0
const newKey = () => `draft-${(counter += 1)}`

const toDraft = (entry: RoutineEntry): DraftEntry => ({
  key: newKey(),
  exerciseId: entry.exercise_id,
  rest: entry.rest,
  sets: entry.sets.map(set => ({ kind: set.kind, kg: set.kg === null ? '' : String(set.kg), reps: set.reps === null ? '' : String(set.reps) })),
})

const toNumber = (text: string) => {
  const value = Number(text.replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

const toEntry = (draft: DraftEntry): RoutineEntry => ({
  exercise_id: draft.exerciseId,
  rest: draft.rest,
  sets: draft.sets.map(set => ({ kind: set.kind, kg: toNumber(set.kg), reps: toNumber(set.reps) })),
})

interface Props {
  ownerId: string
  /** Absent for a new routine. */
  routine?: Routine
  /** Where a new routine goes in the list. */
  position: number
  onSaved: () => Promise<unknown>
}

export function RoutineEditor({ ownerId, routine, position, onSaved }: Props) {
  const router = useRouter()
  const { byId } = useExercises()
  const push = useToasts(state => state.push)
  const [name, setName] = useState(routine?.name ?? '')
  const [entries, setEntries] = useState<DraftEntry[]>(() => routine?.entries.map(toDraft) ?? [])
  const [picking, setPicking] = useState(false)
  const [menu, setMenu] = useState<{ key: string; sheet: 'exercise' | 'rest' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [initial] = useState(() => JSON.stringify({ name: routine?.name ?? '', entries: (routine?.entries ?? []).map(toDraft).map(toEntry) }))

  const ready = name.trim() !== '' && entries.length > 0 && !saving
  const dirty = JSON.stringify({ name, entries: entries.map(toEntry) }) !== initial

  const cancel = () => (dirty ? setLeaving(true) : router.replace('/m/workouts'))

  const change = (key: string, update: (entry: DraftEntry) => DraftEntry) =>
    setEntries(current => current.map(entry => (entry.key === key ? update(entry) : entry)))

  const move = (key: string, by: -1 | 1) =>
    setEntries(current => {
      const next = [...current]
      const from = next.findIndex(entry => entry.key === key)
      const to = from + by
      if (to < 0 || to >= next.length) return current
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })

  const save = async () => {
    if (!ready) return
    setSaving(true)
    const row = { name: name.trim().slice(0, NAME_LIMIT), entries: entries.map(toEntry) }
    const { error } = routine
      ? await supabase.from('routines').update(row).eq('id', routine.id)
      : await supabase.from('routines').insert({ ...row, owner_id: ownerId, position })
    if (error) {
      setSaving(false)
      push({ tone: 'bad', title: 'Routine not saved', message: 'Check your connection and try again.' })
      return
    }
    await onSaved()
    router.replace('/m/workouts')
  }

  const open = menu ? entries.find(entry => entry.key === menu.key) : undefined
  const openIndex = open ? entries.indexOf(open) : -1

  return (
    <div className="-mt-[var(--member-top)] pb-16">
      <header className="sticky top-0 z-30 -mx-5 grid h-14 grid-cols-[1fr_auto_1fr] items-center bg-base/95 px-5 pt-[env(safe-area-inset-top)] backdrop-blur">
        <button type="button" onClick={cancel} className="h-11 justify-self-start text-[15px] font-semibold text-mute">
          Cancel
        </button>
        <span className="text-[17px] font-bold">{routine ? 'Edit routine' : 'New routine'}</span>
        <button
          type="button"
          onClick={save}
          disabled={!ready}
          className="h-11 justify-self-end text-[15px] font-bold text-live transition-opacity disabled:opacity-35"
        >
          {saving ? 'Saving' : 'Save'}
        </button>
      </header>

      <label className="mt-4 block border-b-2 border-edge pb-2 focus-within:border-live">
        <span className="sr-only">Routine name</span>
        <input
          value={name}
          onChange={event => setName(event.target.value.slice(0, NAME_LIMIT))}
          placeholder="Routine name"
          autoFocus={!routine}
          className="w-full bg-transparent font-display text-[34px] uppercase leading-tight tracking-tightest text-chalk outline-none placeholder:text-edge"
        />
      </label>

      {entries.length === 0 && (
        <div className="flex flex-col items-center px-6 pt-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-base-panel text-live">
            <Dumbbell size={28} aria-hidden />
          </span>
          <p className="mt-4 text-[15px] text-mute">Add the exercises you want in this routine. Sets and reps come next.</p>
        </div>
      )}

      {entries.map(entry => {
        const exercise = byId.get(entry.exerciseId)
        const bodyweight = isBodyweight(exercise)
        return (
          <section key={entry.key} className="panel mt-4 p-4 pb-2" aria-label={exercise?.name ?? 'Exercise'}>
            <div className="flex items-center gap-3">
              <ExerciseThumb id={entry.exerciseId} size={46} />
              <h3 className="min-w-0 flex-1 text-[16px] font-bold leading-tight">{exercise?.name ?? 'Loading…'}</h3>
              <button
                type="button"
                onClick={() => setMenu({ key: entry.key, sheet: 'exercise' })}
                aria-label="Exercise options"
                className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-mute active:bg-base-raised"
              >
                <Ellipsis size={21} aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMenu({ key: entry.key, sheet: 'rest' })}
              className="mt-1.5 flex h-9 items-center gap-1.5 text-[13px] font-semibold text-live"
            >
              <Timer size={16} aria-hidden />
              {entry.rest === 0 ? 'Rest timer off' : `Rest ${restLabel(entry.rest)}`}
            </button>

            <div className={cn('mt-1 grid items-center gap-y-1', bodyweight ? 'grid-cols-[48px_1fr_44px]' : 'grid-cols-[48px_1fr_1fr_44px]')}>
              <span className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Set</span>
              {!bodyweight && <span className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Kg</span>}
              <span className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Reps</span>
              <span />
              {entry.sets.map((set, index) => (
                <div key={index} className="contents">
                  <button
                    type="button"
                    onClick={() =>
                      change(entry.key, current => ({
                        ...current,
                        sets: current.sets.map((item, at) => (at === index ? { ...item, kind: item.kind === 'warmup' ? 'normal' : 'warmup' } : item)),
                      }))
                    }
                    aria-label={set.kind === 'warmup' ? 'Warm-up set, tap to make it a working set' : 'Working set, tap to make it a warm-up'}
                    className={cn('h-11 text-[15px] font-bold', set.kind === 'warmup' ? 'text-due' : 'text-chalk')}
                  >
                    {set.kind === 'warmup' ? 'W' : setNumber(entry.sets, index)}
                  </button>
                  {!bodyweight && (
                    <input
                      inputMode="decimal"
                      aria-label={`Set ${index + 1} weight in kilograms`}
                      value={set.kg}
                      placeholder="—"
                      onFocus={event => event.target.select()}
                      onChange={event =>
                        change(entry.key, current => ({
                          ...current,
                          sets: current.sets.map((item, at) => (at === index ? { ...item, kg: event.target.value.replace(/[^\d.,]/g, '').slice(0, 6) } : item)),
                        }))
                      }
                      className="mx-1 h-10 min-w-0 rounded-sm bg-base-raised text-center text-[16px] font-semibold tabular-nums outline-none placeholder:text-mute focus:ring-2 focus:ring-live"
                    />
                  )}
                  <input
                    inputMode="numeric"
                    aria-label={`Set ${index + 1} reps`}
                    value={set.reps}
                    placeholder="—"
                    onFocus={event => event.target.select()}
                    onChange={event =>
                      change(entry.key, current => ({
                        ...current,
                        sets: current.sets.map((item, at) => (at === index ? { ...item, reps: event.target.value.replace(/\D/g, '').slice(0, 3) } : item)),
                      }))
                    }
                    className="mx-1 h-10 min-w-0 rounded-sm bg-base-raised text-center text-[16px] font-semibold tabular-nums outline-none placeholder:text-mute focus:ring-2 focus:ring-live"
                  />
                  <button
                    type="button"
                    disabled={entry.sets.length === 1}
                    onClick={() => change(entry.key, current => ({ ...current, sets: current.sets.filter((_, at) => at !== index) }))}
                    aria-label={`Remove set ${index + 1}`}
                    className="grid h-11 place-items-center text-mute disabled:opacity-25"
                  >
                    <X size={17} aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                change(entry.key, current => {
                  const last = current.sets[current.sets.length - 1]
                  return { ...current, sets: [...current.sets, { kind: 'normal', kg: last?.kg ?? '', reps: last?.reps ?? DEFAULT_REPS }] }
                })
              }
              className="mt-1 flex h-11 w-full items-center justify-center gap-1.5 text-[14px] font-semibold text-chalk-dim"
            >
              <Plus size={16} aria-hidden />
              Add set
            </button>
          </section>
        )
      })}

      <button type="button" onClick={() => setPicking(true)} className={cn('mt-5 w-full', entries.length === 0 ? 'btn-primary' : 'btn-quiet')}>
        <Plus size={19} aria-hidden />
        Add exercise
      </button>

      {picking && (
        <ExercisePicker
          mode="add"
          onClose={() => setPicking(false)}
          onDone={ids => {
            setEntries(current => [
              ...current,
              ...ids.map(id => ({
                key: newKey(),
                exerciseId: id,
                rest: DEFAULT_REST_SECONDS,
                sets: Array.from({ length: 3 }, () => ({ kind: 'normal' as const, kg: '', reps: DEFAULT_REPS })),
              })),
            ])
            setPicking(false)
          }}
        />
      )}

      {leaving && (
        <Dialog
          title="Discard changes?"
          body={routine ? 'Your edits to this routine will be lost.' : 'This routine has not been saved.'}
          confirmLabel="Discard"
          tone="danger"
          onConfirm={() => router.replace('/m/workouts')}
          onClose={() => setLeaving(false)}
        />
      )}

      {menu?.sheet === 'exercise' && open && (
        <ActionSheet
          title={byId.get(open.exerciseId)?.name}
          actions={[
            { label: `Rest timer · ${restLabel(open.rest)}`, icon: Timer, onSelect: () => window.setTimeout(() => setMenu({ key: open.key, sheet: 'rest' }), 0) },
            ...(openIndex > 0 ? [{ label: 'Move up', icon: ArrowUp, onSelect: () => move(open.key, -1) }] : []),
            ...(openIndex < entries.length - 1 ? [{ label: 'Move down', icon: ArrowDown, onSelect: () => move(open.key, 1) }] : []),
            { label: 'Remove exercise', icon: Trash2, tone: 'danger' as const, onSelect: () => setEntries(current => current.filter(entry => entry.key !== open.key)) },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
      {menu?.sheet === 'rest' && open && (
        <ActionSheet
          title="Rest after each set"
          actions={REST_CHOICES.map(seconds => ({
            label: seconds === 0 ? 'No rest timer' : restLabel(seconds),
            chosen: seconds === open.rest,
            onSelect: () => change(open.key, current => ({ ...current, rest: seconds })),
          }))}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
