import { MIN_PASSWORD_LENGTH } from '../../../src/lib/passwords.ts'
import { USERNAME_PATTERN } from '../../../src/lib/members.ts'
import { allowAttempt, passwordSession, serviceClient } from '../_shared/supabase.ts'
import { json, clientAddress, readJson } from '../_shared/http.ts'

interface Body {
  full_name?: string
  phone?: string
  email?: string
  address?: string
  date_of_birth?: string
  username?: string
  password?: string
  referral?: string
}

/**
 * Public sign-up.
 *
 * Accounts are created already confirmed rather than sending a verification
 * email: a gym member joining at the front desk should be able to train the
 * same minute, and the confirmation round trip only ever loses people. The
 * endpoint grants no privileges - the profile trigger always writes role
 * 'member', so this can never mint staff.
 */
Deno.serve(async (request: Request) => {
  const body = await readJson<Body>(request)
  if (!body) return json({ error: 'Malformed request' }, { status: 400 })

  const fullName = body.full_name?.trim()
  const phone = body.phone?.trim()
  const email = body.email?.trim().toLowerCase()
  const address = body.address?.trim() ?? null
  const dateOfBirth = body.date_of_birth?.trim() || null
  const username = body.username?.trim().toLowerCase()
  const password = body.password ?? ''
  const referral = body.referral?.trim().toLowerCase() ?? null

  if (!fullName || fullName.length < 2) {
    return json({ error: 'Enter your full name' }, { status: 400 })
  }
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return json({ error: 'Enter a valid phone number' }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json({ error: 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters' }, { status: 400 })
  }
  if (!username || !USERNAME_PATTERN.test(username)) {
    return json({ error: 'Username must be 3-20 letters, numbers or underscore' }, { status: 400 })
  }

  if (!(await allowAttempt('join:ip:' + clientAddress(request), 6, 60))) {
    return json({ error: 'Too many sign ups from this connection. Try again later.' }, { status: 429 })
  }

  const admin = serviceClient()

  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (taken) {
    return json({ error: 'Username already exists' }, { status: 409 })
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, address, date_of_birth: dateOfBirth, username, referral },
  })

  if (error) {
    const message = /already registered|already been registered/i.test(error.message)
      ? 'An account with that email already exists'
      : 'Could not create your account. Try again.'
    return json({ error: message }, { status: 400 })
  }

  // Signing in here means a dropped connection cannot leave a new member with
  // an account they are then told already exists.
  const { data: signedIn } = await passwordSession(email, password)
  if (!signedIn.session) return json({ ok: true })
  return json({
    ok: true,
    access_token: signedIn.session.access_token,
    refresh_token: signedIn.session.refresh_token,
  })
})
