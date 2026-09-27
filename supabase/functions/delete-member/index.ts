import { callerProfile, serviceClient } from '../_shared/supabase.ts'
import { json, readJson } from '../_shared/http.ts'

/**
 * Removes an account. Admin only: the person goes, while their payments and
 * visits stay on the books detached from the account. The audit entry is
 * written first because the profile row goes with the account.
 */
Deno.serve(async (request: Request) => {
  const caller = await callerProfile(request)
  if (!caller || caller.role !== 'admin') {
    return json({ error: 'Only an admin can delete an account' }, { status: 403 })
  }

  const body = await readJson<{ user_id?: string }>(request)
  if (!body) return json({ error: 'Malformed request' }, { status: 400 })

  const userId = body.user_id
  if (!userId) return json({ error: 'Which account?' }, { status: 400 })
  if (userId === caller.id) {
    return json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const admin = serviceClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', userId)
    .maybeSingle()

  if (!target) return json({ error: 'No such account' }, { status: 404 })

  await admin.from('audit_log').insert({
    actor_id: caller.id,
    action: 'delete_account',
    entity: 'profiles',
    entity_id: userId,
    details: { full_name: target.full_name, email: target.email, role: target.role },
  })

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return json({ error: 'Could not delete this account. Try again.' }, { status: 400 })

  return json({ deleted: userId })
})
