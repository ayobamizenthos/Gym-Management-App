import { NextResponse } from 'next/server'
import { callerProfile, serviceClient } from '@/lib/server-supabase'
import { readJson } from '@/lib/server-http'

export const dynamic = 'force-dynamic'

/**
 * Removes an account for good. Only an owner may do this: a receptionist works
 * the desk every day and a mis-tap would take a member's payment history with
 * it, so the capability stays with the person who answers for the business.
 *
 * The audit entry is written before the delete, because the profile row goes
 * with the account and there would be nothing left to point at afterwards.
 */
export async function POST(request: Request) {
  const caller = await callerProfile(request)
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can delete an account' }, { status: 403 })
  }

  const body = await readJson<{ user_id?: string }>(request)
  if (!body) return NextResponse.json({ error: 'Malformed request' }, { status: 400 })

  const userId = body.user_id
  if (!userId) return NextResponse.json({ error: 'Which account?' }, { status: 400 })
  if (userId === caller.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const admin = serviceClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', userId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'No such account' }, { status: 404 })

  await admin.from('audit_log').insert({
    actor_id: caller.id,
    action: 'delete_account',
    entity: 'profiles',
    entity_id: userId,
    details: { full_name: target.full_name, email: target.email, role: target.role },
  })

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ deleted: userId })
}
