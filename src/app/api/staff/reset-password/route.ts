import { NextResponse } from 'next/server'
import { callerProfile, serviceClient } from '@/lib/server-supabase'
import { temporaryPassword } from '@/lib/server-credentials'
import { readJson } from '@/lib/server-http'

export const dynamic = 'force-dynamic'

/**
 * Most members join from a paper form and have no inbox we can mail, so the
 * desk issues a new password face to face. A receptionist may only ever do this
 * for a member - resetting a colleague's login would be a way to take the
 * admin account.
 */
export async function POST(request: Request) {
  const caller = await callerProfile(request)
  if (!caller || (caller.role !== 'receptionist' && caller.role !== 'admin')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  const body = await readJson<{ user_id?: string }>(request)
  if (!body) return NextResponse.json({ error: 'Malformed request' }, { status: 400 })

  const userId = body.user_id
  if (!userId) return NextResponse.json({ error: 'Which member?' }, { status: 400 })
  if (userId === caller.id) {
    return NextResponse.json({ error: 'Change your own password from your account' }, { status: 400 })
  }

  const admin = serviceClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'No such member' }, { status: 404 })
  if (target.role !== 'member' && caller.role !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can reset a staff password' }, { status: 403 })
  }

  const password = temporaryPassword()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    actor_id: caller.id,
    action: 'reset_password',
    entity: 'profiles',
    entity_id: userId,
    details: { by_role: caller.role, target_role: target.role },
  })

  return NextResponse.json({ password })
}
