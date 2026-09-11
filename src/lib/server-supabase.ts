import { createClient } from '@supabase/supabase-js'

/** Service-role client. Server only - never import this from a client component. */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase server credentials are not configured')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Resolves the caller from their bearer token and returns their profile row. */
export async function callerProfile(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const admin = serviceClient()
  const { data: userData } = await admin.auth.getUser(token)
  if (!userData.user) return null
  const { data } = await admin
    .from('profiles')
    .select('id, role, branch_id')
    .eq('id', userData.user.id)
    .maybeSingle()
  return data as { id: string; role: string; branch_id: string | null } | null
}
