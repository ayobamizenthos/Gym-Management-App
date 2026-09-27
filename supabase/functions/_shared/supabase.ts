import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!

export const serviceClient = () =>
  createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

/** Resolves the caller from their bearer token and returns their profile row. */
export async function callerProfile(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const admin = serviceClient()
  const { data: userData } = await admin.auth.getUser(token)
  if (!userData.user) return null
  const { data } = await admin
    .from('profiles')
    .select('id, role, branch_id, email')
    .eq('id', userData.user.id)
    .maybeSingle()
  return data as { id: string; role: string; branch_id: string | null; email: string | null } | null
}

/** Counts an attempt against a bucket; false once the bucket is full for the window. */
export async function allowAttempt(bucket: string, limit: number, windowMinutes: number) {
  const { data, error } = await serviceClient().rpc('allow_attempt', {
    p_bucket: bucket,
    p_limit: limit,
    p_window: windowMinutes + ' minutes',
  })
  return !error && data === true
}

/** Signs in with the publishable key and hands back the session tokens. */
export function passwordSession(email: string, password: string) {
  const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return auth.auth.signInWithPassword({ email, password })
}
