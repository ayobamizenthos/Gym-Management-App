import { FALLBACK_GYM_NAME } from '@/lib/settings'

const GYM_NAME_REVALIDATE_SECONDS = 3600

/** The gym name for server-rendered metadata, read with the publishable key. */
export async function fetchGymName(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return FALLBACK_GYM_NAME
  try {
    const response = await fetch(url + '/rest/v1/settings?select=gym_name', {
      headers: { apikey: key },
      next: { revalidate: GYM_NAME_REVALIDATE_SECONDS },
    })
    if (!response.ok) return FALLBACK_GYM_NAME
    const [row] = (await response.json()) as { gym_name: string | null }[]
    return row?.gym_name?.trim() || FALLBACK_GYM_NAME
  } catch {
    return FALLBACK_GYM_NAME
  }
}
