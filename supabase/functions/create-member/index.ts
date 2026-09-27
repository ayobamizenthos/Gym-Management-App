import { randomUUID } from 'node:crypto'
import { MIN_PASSWORD_LENGTH } from '../../../src/lib/passwords.ts'
import { callerProfile, serviceClient } from '../_shared/supabase.ts'
import { PLACEHOLDER_EMAIL_DOMAIN, USERNAME_PATTERN } from '../../../src/lib/members.ts'
import { temporaryPassword } from '../_shared/credentials.ts'
import { json, readJson } from '../_shared/http.ts'

interface Body {
  full_name?: string
  phone?: string
  email?: string
  date_of_birth?: string
  username?: string
  password?: string
  branch_id?: string | null
}

Deno.serve(async (request: Request) => {
  const caller = await callerProfile(request)
  if (!caller || (caller.role !== 'receptionist' && caller.role !== 'admin')) {
    return json({ error: 'Not permitted' }, { status: 403 })
  }

  const body = await readJson<Body>(request)
  if (!body) return json({ error: 'Malformed request' }, { status: 400 })

  const fullName = body.full_name?.trim()
  const phone = body.phone?.trim()
  const email = body.email?.trim().toLowerCase()
  const dateOfBirth = body.date_of_birth?.trim() || null
  const username = body.username?.trim().toLowerCase()

  if (!fullName || !phone) {
    return json({ error: 'Name and phone are required' }, { status: 400 })
  }
  if (username && !USERNAME_PATTERN.test(username)) {
    return json({ error: 'Username must be 3-20 letters, numbers or underscore' }, { status: 400 })
  }

  const admin = serviceClient()

  if (username) {
    const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
    if (taken) return json({ error: 'Username already exists' }, { status: 409 })
  }

  // Members registered from a paper form often have no email. Mint a stable
  // placeholder so the account still exists and can be claimed later.
  const login = email || `m${randomUUID()}${PLACEHOLDER_EMAIL_DOMAIN}`
  const password = body.password || temporaryPassword()
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json({ error: 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters' }, { status: 400 })
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: login,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, date_of_birth: dateOfBirth, username: username ?? null },
  })
  if (error) {
    const message = /already registered|already been registered/i.test(error.message) ? 'That email already has an account' : 'Could not register this member. Try again.'
    return json({ error: message }, { status: 400 })
  }

  // The front desk registers people into its own branch; only an admin chooses.
  const branchId = caller.role === 'admin' ? body.branch_id : caller.branch_id
  if (branchId) {
    await admin.from('profiles').update({ branch_id: branchId }).eq('id', data.user.id)
  }
  await admin.from('audit_log').insert({
    actor_id: caller.id,
    action: 'create_member',
    entity: 'profiles',
    entity_id: data.user.id,
    details: { full_name: fullName, by_role: caller.role },
  })

  return json({ id: data.user.id, email: login, password })
})
