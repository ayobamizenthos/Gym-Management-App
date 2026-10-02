import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FinishResult, PlannedSet, RoutineEntry, SetKind } from '@/lib/workouts'
import { DEFAULT_REST_SECONDS } from '@/lib/workouts'

/** Fields hold what was typed, so "72." survives until the next keystroke. */
export interface LiveSet {
  kind: SetKind
  kg: string
  reps: string
  done: boolean
}

export interface LiveEntry {
  key: string
  exerciseId: string
  rest: number
  sets: LiveSet[]
  /** The routine's targets, shown faintly when there is no previous session. */
  plan: PlannedSet[]
}

export interface Session {
  routineId: string | null
  name: string
  startedAt: number
  entries: LiveEntry[]
}

export interface Rest {
  endsAt: number
  total: number
  exerciseId: string
  /** The set the member is resting before. */
  nextSet: number
  /** "Set 3 of Barbell Bench Press", for the alert if the app is closed. */
  label: string
}

interface WorkoutState {
  session: Session | null
  /** Sets from each exercise's last session: the "previous" column and the faint suggestions. */
  previous: Record<string, PlannedSet[]>
  rest: Rest | null
  /** The finish that the celebration screen is about to show. */
  celebrate: FinishResult | null

  begin: (name: string, routineId: string | null, entries: RoutineEntry[]) => void
  setPrevious: (previous: Record<string, PlannedSet[]>) => void
  addExercises: (ids: string[]) => void
  replaceExercise: (key: string, exerciseId: string) => void
  removeExercise: (key: string) => void
  moveExercise: (key: string, by: -1 | 1) => void
  setRest: (key: string, seconds: number) => void
  addSet: (key: string) => void
  removeSet: (key: string, index: number) => void
  setKind: (key: string, index: number, kind: SetKind) => void
  editSet: (key: string, index: number, patch: Partial<Pick<LiveSet, 'kg' | 'reps'>>) => void
  /** Ticks or unticks a set; returns true when it was just completed. */
  toggleDone: (key: string, index: number) => boolean
  startRest: (seconds: number, exerciseId: string, nextSet: number, label: string) => void
  nudgeRest: (by: number) => void
  endRest: () => void
  rename: (name: string) => void
  finished: (result: FinishResult) => void
  discard: () => void
}

let counter = 0
const newKey = () => `${Date.now().toString(36)}-${(counter += 1)}`

const blankSet = (kind: SetKind = 'normal'): LiveSet => ({ kind, kg: '', reps: '', done: false })

const fromPlan = (entry: RoutineEntry): LiveEntry => ({
  key: newKey(),
  exerciseId: entry.exercise_id,
  rest: entry.rest,
  sets: entry.sets.map(set => blankSet(set.kind)),
  plan: entry.sets,
})

const freshEntry = (exerciseId: string): LiveEntry => ({
  key: newKey(),
  exerciseId,
  rest: DEFAULT_REST_SECONDS,
  sets: [blankSet(), blankSet(), blankSet()],
  plan: [],
})

/** What a blank field will be taken as when its set is ticked. */
export function suggestion(entry: LiveEntry, previous: PlannedSet[] | undefined, index: number) {
  const before = previous?.[index] ?? previous?.[previous.length - 1]
  const planned = entry.plan[index] ?? entry.plan[entry.plan.length - 1]
  return {
    kg: before?.kg ?? planned?.kg ?? null,
    reps: before?.reps ?? planned?.reps ?? null,
  }
}

const parse = (text: string) => {
  const value = Number(text.replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null
}

export const setNumber = (sets: { kind: SetKind }[], index: number) =>
  sets.slice(0, index + 1).filter(set => set.kind === 'normal').length

export const useWorkout = create<WorkoutState>()(
  persist(
    (set, get) => {
      const mapEntry = (key: string, change: (entry: LiveEntry) => LiveEntry) =>
        set(state =>
          state.session
            ? { session: { ...state.session, entries: state.session.entries.map(entry => (entry.key === key ? change(entry) : entry)) } }
            : state
        )

      return {
        session: null,
        previous: {},
        rest: null,
        celebrate: null,

        begin: (name, routineId, entries) =>
          set({
            session: { name, routineId, startedAt: Date.now(), entries: entries.map(fromPlan) },
            previous: {},
            rest: null,
            celebrate: null,
          }),

        setPrevious: previous => set(state => ({ previous: { ...state.previous, ...previous } })),

        addExercises: ids =>
          set(state =>
            state.session ? { session: { ...state.session, entries: [...state.session.entries, ...ids.map(freshEntry)] } } : state
          ),

        replaceExercise: (key, exerciseId) =>
          mapEntry(key, entry => ({ ...entry, exerciseId, plan: [], sets: entry.sets.map(item => blankSet(item.kind)) })),

        removeExercise: key =>
          set(state =>
            state.session
              ? {
                  session: { ...state.session, entries: state.session.entries.filter(entry => entry.key !== key) },
                  rest: state.rest && state.session.entries.find(entry => entry.key === key)?.exerciseId === state.rest.exerciseId ? null : state.rest,
                }
              : state
          ),

        moveExercise: (key, by) =>
          set(state => {
            if (!state.session) return state
            const entries = [...state.session.entries]
            const from = entries.findIndex(entry => entry.key === key)
            const to = from + by
            if (from < 0 || to < 0 || to >= entries.length) return state
            ;[entries[from], entries[to]] = [entries[to], entries[from]]
            return { session: { ...state.session, entries } }
          }),

        setRest: (key, seconds) => mapEntry(key, entry => ({ ...entry, rest: seconds })),

        addSet: key =>
          mapEntry(key, entry => {
            const last = entry.sets[entry.sets.length - 1]
            // a new set starts from the one above it, the way people actually train
            return { ...entry, sets: [...entry.sets, { kind: 'normal', kg: last?.kg ?? '', reps: last?.reps ?? '', done: false }] }
          }),

        removeSet: (key, index) => mapEntry(key, entry => ({ ...entry, sets: entry.sets.filter((_, at) => at !== index) })),

        setKind: (key, index, kind) =>
          mapEntry(key, entry => ({ ...entry, sets: entry.sets.map((item, at) => (at === index ? { ...item, kind } : item)) })),

        editSet: (key, index, patch) =>
          mapEntry(key, entry => ({ ...entry, sets: entry.sets.map((item, at) => (at === index ? { ...item, ...patch } : item)) })),

        toggleDone: (key, index) => {
          const { session, previous } = get()
          const entry = session?.entries.find(item => item.key === key)
          const target = entry?.sets[index]
          if (!entry || !target) return false
          if (target.done) {
            mapEntry(key, current => ({ ...current, sets: current.sets.map((item, at) => (at === index ? { ...item, done: false } : item)) }))
            return false
          }
          const hint = suggestion(entry, previous[entry.exerciseId], index)
          const kg = parse(target.kg) ?? hint.kg
          const reps = parse(target.reps) ?? hint.reps
          if (reps === null || reps === 0) return false
          mapEntry(key, current => ({
            ...current,
            sets: current.sets.map((item, at) =>
              at === index ? { ...item, kg: kg === null ? '' : String(kg), reps: String(reps), done: true } : item
            ),
          }))
          return true
        },

        startRest: (seconds, exerciseId, nextSet, label) =>
          set({ rest: seconds > 0 ? { endsAt: Date.now() + seconds * 1000, total: seconds, exerciseId, nextSet, label } : null }),

        nudgeRest: by =>
          set(state => {
            if (!state.rest) return state
            const endsAt = Math.max(Date.now() + 1000, state.rest.endsAt + by * 1000)
            return { rest: { ...state.rest, endsAt, total: Math.max(state.rest.total + by, 1) } }
          }),

        endRest: () => set({ rest: null }),

        rename: name => set(state => (state.session ? { session: { ...state.session, name } } : state)),

        finished: result => set({ session: null, rest: null, previous: {}, celebrate: result }),

        discard: () => set({ session: null, rest: null, previous: {} }),
      }
    },
    { name: 'zg:live-workout', partialize: state => ({ session: state.session, previous: state.previous, rest: state.rest }) }
  )
)

/** Only ticked sets are saved, with blank weights stored as zero. */
export function sessionPayload(session: Session) {
  return session.entries
    .map(entry => ({
      exercise_id: entry.exerciseId,
      rest: entry.rest,
      sets: entry.sets
        .filter(item => item.done)
        .map(item => ({ kind: item.kind, kg: parse(item.kg) ?? 0, reps: parse(item.reps) ?? 0 })),
    }))
    .filter(entry => entry.sets.length > 0)
}

export const liveVolume = (session: Session) =>
  session.entries.reduce(
    (sum, entry) => sum + entry.sets.reduce((acc, item) => acc + (item.done ? (parse(item.kg) ?? 0) * (parse(item.reps) ?? 0) : 0), 0),
    0
  )

export const liveSetCount = (session: Session) =>
  session.entries.reduce((sum, entry) => sum + entry.sets.filter(item => item.done).length, 0)
