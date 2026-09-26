import { supabase } from '@/lib/supabase'

export type Reply<T> = { ok: true; body: T } | { ok: false; status: number; error: string }

const OFFLINE = 'No connection. Check your data and try again.'

/**
 * POSTs to one of the app's own routes. A dropped connection or a host error
 * page comes back as a readable failure instead of an exception, so no button
 * is ever left spinning.
 */
export async function postJson<T>(path: string, payload: unknown, options: { signed?: boolean } = {}): Promise<Reply<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.signed) {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = 'Bearer ' + data.session.access_token
  }
  try {
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok || !body) return { ok: false, status: res.status, error: body?.error ?? 'Something went wrong. Try again.' }
    return { ok: true, body }
  } catch {
    return { ok: false, status: 0, error: OFFLINE }
  }
}

/** Only paths inside the app are followed after sign in. */
export function safeNext(raw: string | null | undefined) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  return raw
}
