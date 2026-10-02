'use client'

import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useCached } from '@/hooks/useCached'

export interface Exercise {
  id: string
  name: string
  body_part: string
  target: string
  equipment: string
  rank: number
}

export interface ExerciseDetail extends Exercise {
  secondary: string[]
  steps: string[]
}

export const exerciseGif = (id: string) => `https://static.exercisedb.dev/media/${id}.gif`

export interface MuscleGroup {
  key: string
  label: string
  parts: string[]
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { key: 'chest', label: 'Chest', parts: ['chest'] },
  { key: 'back', label: 'Back', parts: ['back'] },
  { key: 'shoulders', label: 'Shoulders', parts: ['shoulders'] },
  { key: 'arms', label: 'Arms', parts: ['upper arms', 'lower arms'] },
  { key: 'legs', label: 'Legs', parts: ['upper legs', 'lower legs'] },
  { key: 'core', label: 'Core', parts: ['waist'] },
  { key: 'cardio', label: 'Cardio', parts: ['cardio'] },
]

const MUSCLE_WORDS: Record<string, string> = {
  pectorals: 'Chest',
  'latissimus dorsi': 'Lats',
  deltoids: 'Shoulders',
  'upper back': 'Upper back',
  'erector spinae': 'Lower back',
  trapezius: 'Traps',
  'serratus anterior': 'Serratus',
  abdominals: 'Abs',
  quadriceps: 'Quads',
  'cardiovascular system': 'Cardio',
  'levator scapulae': 'Neck',
}

const EQUIPMENT_WORDS: Record<string, string> = {
  bodyweight: 'Bodyweight',
  dumbbell: 'Dumbbells',
  'leverage machine': 'Machine',
  'sled machine': 'Machine',
  'olympic barbell': 'Barbell',
  'EZ bar': 'EZ bar',
  weighted: 'Weighted',
  assisted: 'Assisted',
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const muscleLabel = (muscle: string) => MUSCLE_WORDS[muscle] ?? capitalise(muscle)
export const equipmentLabel = (equipment: string) => EQUIPMENT_WORDS[equipment] ?? capitalise(equipment)
export const exerciseCaption = (exercise: Pick<Exercise, 'target' | 'equipment'>) =>
  `${muscleLabel(exercise.target)} · ${equipmentLabel(exercise.equipment)}`

/** No load to log: the member's own body is the weight. */
export const isBodyweight = (exercise: Pick<Exercise, 'equipment'> | undefined) =>
  exercise?.equipment === 'bodyweight' || exercise?.equipment === 'assisted'

// The API caps every response at 1,000 rows, so the library arrives in pages.
const PAGE_ROWS = 1000

async function loadCatalogue(): Promise<Exercise[]> {
  const rows: Exercise[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, body_part, target, equipment, rank')
      .order('rank', { ascending: false })
      .order('id')
      .range(from, from + PAGE_ROWS - 1)
    if (error) throw error
    rows.push(...(data as Exercise[]))
    if (data.length < PAGE_ROWS) break
  }
  return rows.sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name))
}

/** The whole library, painted from the last copy and refreshed in the background. */
export function useExercises() {
  const { data, loading } = useCached<Exercise[]>('exercises', loadCatalogue)
  const list = useMemo(() => data ?? [], [data])
  const byId = useMemo(() => new Map(list.map(exercise => [exercise.id, exercise])), [list])
  return { exercises: list, byId, loading }
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** Every typed word must start a word of the name, muscle or equipment; gym shorthand "db" and "bb" mean dumbbell and barbell. */
export function searchExercises(list: Exercise[], query: string, group: string | null) {
  const parts = group ? MUSCLE_GROUPS.find(entry => entry.key === group)?.parts ?? [] : null
  const terms = words(query.replace(/\bdb\b/gi, 'dumbbell').replace(/\bbb\b/gi, 'barbell'))
  return list.filter(exercise => {
    if (parts && !parts.includes(exercise.body_part)) return false
    if (terms.length === 0) return true
    const haystack = words(`${exercise.name} ${exercise.target} ${muscleLabel(exercise.target)} ${exercise.equipment}`)
    return terms.every(term => haystack.some(word => word.startsWith(term)))
  })
}
