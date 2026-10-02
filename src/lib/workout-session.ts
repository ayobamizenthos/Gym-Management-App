'use client'

import { supabase } from '@/lib/supabase'
import { useWorkout } from '@/stores/workout'
import type { PlannedSet, RoutineEntry } from '@/lib/workouts'

async function loadPrevious(ids: string[]) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const { data } = await supabase.rpc('last_sets', { p_exercises: unique })
  const rows = (data ?? []) as { exercise_id: string; sets: PlannedSet[] }[]
  useWorkout.getState().setPrevious(Object.fromEntries(rows.map(row => [row.exercise_id, row.sets])))
}

/** Opens a session and fetches what the member lifted last time, without holding up the screen. */
export function startWorkout(name: string, routineId: string | null, entries: RoutineEntry[]) {
  useWorkout.getState().begin(name, routineId, entries)
  void loadPrevious(entries.map(entry => entry.exercise_id))
}

export function addToWorkout(ids: string[]) {
  useWorkout.getState().addExercises(ids)
  void loadPrevious(ids)
}

export function swapInWorkout(key: string, exerciseId: string) {
  useWorkout.getState().replaceExercise(key, exerciseId)
  void loadPrevious([exerciseId])
}

/** An empty start is named after the day: "Friday workout". */
export const emptyWorkoutName = () =>
  `${new Date().toLocaleDateString('en-NG', { weekday: 'long' })} workout`
