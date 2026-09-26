import { NextResponse } from 'next/server'
import { USERNAME_PATTERN } from '@/lib/members'
import { allowAttempt, passwordSession, serviceClient } from '@/lib/server-supabase'
import { clientAddress, readJson } from '@/lib/server-http'

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

  const tooMany = NextResponse.json({ error: 'Too many attempts. Wait a few minutes and try again.' }, { status: 429 })
  if (!(await allowAttempt('signin:ip:' + clientAddress(request), 30, 10))) return tooMany
  if (!(await allowAttempt('signin:id:' + identifier.toLowerCase(), 8, 10))) return tooMany

  let email = identifier.toLowerCase()

  if (!identifier.includes('@')) {
    const username = identifier.toLowerCase()
    if (!USERNAME_PATTERN.test(username)) {
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

  const { data, error } = await passwordSession(email, password)

  if (error?.status === 429) return tooMany
  if (error || !data.session) {
    return NextResponse.json({ error: 'Wrong details. Check and try again.' }, { status: 400 })
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
