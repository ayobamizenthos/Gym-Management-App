'use client'

import { supabase } from '@/lib/supabase'
import { SETTINGS_DEFAULTS } from '@/lib/settings'
import { useCached } from '@/hooks/useCached'
import type { Settings } from '@/lib/types'

async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase.from('settings').select('*').maybeSingle()
  if (error) throw error
  return data as Settings | null
}

export function useSettings() {
  const { data, settled, revalidate } = useCached<Settings | null>('settings', fetchSettings)
  return { settings: data ?? SETTINGS_DEFAULTS, loaded: data !== null, settled, revalidate }
}

export const useGymName = () => useSettings().settings.gym_name
