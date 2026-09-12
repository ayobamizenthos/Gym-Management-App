import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/server-supabase'
import { readJson } from '@/lib/server-http'

export const dynamic = 'force-dynamic'

/**
 * Signs in with either an email address or an invite name.
 *
 * The username to email mapping is resolved here rather than in the browser -
 * exposing it to anonymous clients would hand an attacker the whole member
 * roster. A wrong name and a wrong password are answered identically, and an
 * unknown name still pays for a password check so the response time cannot be
 * used to test whether someone is a member.
 */
export async function POST(request: Request) {
  const body = await readJson<{ identifier?: string; password?: string }>(request)
  if (!body) return NextResponse.json({ error: 'Malformed request' }, { status: 400 })

  const identifier = body.identifier?.trim() ?? ''
  const password = body.password ?? ''
  if (!identifier || !password) {
    return NextResponse.json({ error: 'Enter your details' }, { status: 400 })
  }

  let email = identifier.toLowerCase()

  if (!identifier.includes('@')) {
    const username = identifier.toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: 'Wrong details. Check and try again.' }, { status: 400 })
    }
    const { data } = await serviceClient()
      .from('profiles')
      .select('email')
      .eq('username', username)
      .maybeSingle()
    // A miss still runs the grant below against an address that cannot exist,
    // so both paths cost the same.
    email = data?.email ?? 'unclaimed.' + username + '@members.invalid'
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !publishable) {
    return NextResponse.json({ error: 'Sign in is not configured' }, { status: 500 })
  }

  const auth = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await auth.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    const tooMany = error?.status === 429
    return NextResponse.json(
      { error: tooMany ? 'Too many attempts. Wait a moment and try again.' : 'Wrong details. Check and try again.' },
      { status: tooMany ? 429 : 400 }
    )
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
