import { MIN_PASSWORD_LENGTH } from '../../../src/lib/passwords.ts'
import { callerProfile, serviceClient } from '../_shared/supabase.ts'
import { temporaryPassword } from '../_shared/credentials.ts'
import { json, readJson } from '../_shared/http.ts'

Deno.serve(async (request: Request) => {
  const caller = await callerProfile(request)
  if (!caller || caller.role !== 'admin') {
    return json({ error: 'Not permitted' }, { status: 403 })
  }

  const body = await readJson<{
    full_name?: string
    email?: string
    password?: string
    role?: 'receptionist' | 'admin'
    branch_id?: string | null
  }>(request)
  if (!body) return json({ error: 'Malformed request' }, { status: 400 })

  const fullName = body.full_name?.trim()
  const email = body.email?.trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'receptionist'

  if (!fullName || !email) {
    return json({ error: 'Name and email are required' }, { status: 400 })
  }

  const admin = serviceClient()
  const password = body.password || temporaryPassword()
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json({ error: 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters' }, { status: 400 })
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) {
    const message = /already registered|already been registered/i.test(error.message) ? 'That email already has an account' : 'Could not create this account. Try again.'
    return json({ error: message }, { status: 400 })
  }

  const { error: roleError } = await admin
    .from('profiles')
    .update({ role, branch_id: body.branch_id ?? null })
    .eq('id', data.user.id)
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return json({ error: 'Could not create this account. Try again.' }, { status: 400 })
  }

  await admin.from('audit_log').insert({
    actor_id: caller.id,
    action: 'create_staff',
    entity: 'profiles',
    entity_id: data.user.id,
    details: { email, role },
  })

  return json({ id: data.user.id, email, password, role })
})
