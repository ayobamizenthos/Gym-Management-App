'use client'

import { supabase } from '@/lib/supabase'
import { useCached } from '@/hooks/useCached'

export type SetKind = 'normal' | 'warmup'

export interface PlannedSet {
  kind: SetKind
  kg: number | null
  reps: number | null
}

export interface RoutineEntry {
  exercise_id: string
  /** Seconds of rest after each set. */
  rest: number
  sets: PlannedSet[]
}

export interface Routine {
  id: string
  owner_id: string | null
  name: string
  summary: string | null
  entries: RoutineEntry[]
  position: number
  updated_at: string
}

export interface PersonalBest {
  exercise_id: string
  kind: 'weight' | 'reps'
  kg?: number
  reps: number
}

export interface Workout {
  id: string
  routine_id: string | null
  name: string
  started_at: string
  ended_at: string
  entries: RoutineEntry[]
  volume_kg: number
  set_count: number
  records: PersonalBest[]
}

export interface FinishResult {
  id: string
  records: PersonalBest[]
  ordinal: number
  streak_weeks: number
}

export const DEFAULT_REST_SECONDS = 90
export const REST_CHOICES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300]

/** 52:10 under an hour, 1:05:12 past it. */
export function clock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** 48 min, 1h 05m. */
export function spoken(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export const restLabel = (seconds: number) => (seconds === 0 ? 'Off' : clock(seconds))

export const kgLabel = (kg: number) => `${Number(kg.toFixed(2)).toLocaleString('en-NG')} kg`

export const volumeLabel = (kg: number) => `${Math.round(kg).toLocaleString('en-NG')} kg`

export const secondsBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 1000

/** Monday-first week, matching the gym's calendar. */
export function startOfWeek(at: Date) {
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate())
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}

export const dayKey = (at: Date) => `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`

async function loadRoutines(owner: string): Promise<Routine[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('id, owner_id, name, summary, entries, position, updated_at')
    .or(`owner_id.eq.${owner},owner_id.is.null`)
    .order('position')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Routine[]
}

/** The member's own routines and the gym's Explore workouts, in one request. */
export function useRoutines(owner: string | undefined) {
  const { data, loading, revalidate } = useCached<Routine[]>(`routines:${owner ?? 'none'}`, () =>
    owner ? loadRoutines(owner) : Promise.resolve([])
  )
  const all = data ?? []
  return {
    mine: all.filter(routine => routine.owner_id === owner),
    explore: all.filter(routine => routine.owner_id === null),
    loading,
    revalidate,
  }
}

// Enough for the calendar and the recent list without paging.
const HISTORY_LIMIT = 120

async function loadHistory(owner: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, routine_id, name, started_at, ended_at, entries, volume_kg, set_count, records')
    .eq('user_id', owner)
    .order('ended_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw error
  return data as Workout[]
}

export function useWorkoutHistory(owner: string | undefined) {
  const { data, loading, revalidate } = useCached<Workout[]>(`workouts:${owner ?? 'none'}`, () =>
    owner ? loadHistory(owner) : Promise.resolve([])
  )
  return { workouts: data ?? [], loading, revalidate }
}

/** One logged workout. A finished session is never edited, so the cached copy is always right. */
export function useWorkoutById(id: string) {
  return useCached<Workout | null>(`workout:${id}`, async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, routine_id, name, started_at, ended_at, entries, volume_kg, set_count, records')
      .eq('id', id)
      .maybeSingle()
    return (data as Workout | null) ?? null
  })
}
