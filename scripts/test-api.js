// Route-level suite. RLS guards the database; these routes hold a service key,
// so each one is probed with a token that must not be good enough for it.
// Accounts are minted and destroyed here, so no credentials live in the repo.
require('dotenv').config({ path: '.env.local' })
const { required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')
const PUBLISHABLE = required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const APP = process.env.APP_URL || 'http://127.0.0.1:4312'

const service = (path, options = {}) =>
  fetch(URL + path, {
    ...options,
    headers: { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })

const passed = []
const problems = []
const expect = (ok, description) => (ok ? passed.push(description) : problems.push(description))

async function makeUser(role, username) {
  const email = 'probe_' + role + '_' + Date.now() + Math.random().toString(36).slice(2, 6) + '@zenthos.test'
  const password = 'Probe' + Math.random().toString(36).slice(2, 10) + '#9'
  const created = await (await service('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Probe ' + role, ...(username ? { username } : {}) },
    }),
  })).json()
  if (role !== 'member') {
    await service('/rest/v1/profiles?id=eq.' + created.id, { method: 'PATCH', body: JSON.stringify({ role }) })
  }
  const session = await (await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })).json()
  return { id: created.id, email, password, username, token: session.access_token }
}

const call = (path, token, body) =>
  fetch(APP + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  })

;(async () => {
  const reachable = await fetch(APP + '/login').then(r => r.ok).catch(() => false)
  if (!reachable) {
    console.log('App not reachable at ' + APP + ' - start it first (APP_URL overrides the address).')
    process.exitCode = 1
    return
  }

  const member = await makeUser('member')
  const desk = await makeUser('receptionist')
  const boss = await makeUser('admin')
  const victim = await makeUser('member')
  const named = await makeUser('member', 'probe' + Math.random().toString(36).slice(2, 8))

  try {
    // ---- no token at all ----
    for (const route of ['/api/staff/create-member', '/api/staff/reset-password', '/api/admin/create-staff']) {
      const res = await call(route, null, { user_id: victim.id })
      expect(res.status === 403, 'anonymous call to ' + route + ' is refused')
    }

    // ---- a member holds a valid token but no standing ----
    expect((await call('/api/staff/create-member', member.token, { full_name: 'Ghost', phone: '08000000000' })).status === 403,
      'a member cannot register other members')
    expect((await call('/api/staff/reset-password', member.token, { user_id: victim.id })).status === 403,
      'a member cannot reset another password')
    expect((await call('/api/admin/create-staff', member.token, { full_name: 'Ghost', email: 'ghost@zenthos.test' })).status === 403,
      'a member cannot create staff')

    // ---- a receptionist must not be able to take over a colleague or the owner ----
    expect((await call('/api/admin/create-staff', desk.token, { full_name: 'Ghost', email: 'ghost2@zenthos.test' })).status === 403,
      'a receptionist cannot create staff')
    expect((await call('/api/staff/reset-password', desk.token, { user_id: boss.id })).status === 403,
      'a receptionist cannot reset the admin password')
    expect((await call('/api/staff/reset-password', desk.token, { user_id: desk.id })).status === 400,
      'nobody resets their own password through the desk route')

    // ---- the legitimate path still works, and the old password really dies ----
    const issued = await call('/api/staff/reset-password', desk.token, { user_id: victim.id })
    const payload = await issued.json()
    expect(issued.ok && typeof payload.password === 'string' && payload.password.length >= 10,
      'a receptionist can issue a member a new password')

    const oldLogin = await fetch(URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: victim.email, password: victim.password }),
    })
    expect(oldLogin.status >= 400, 'the replaced password stops working')

    const newLogin = await fetch(URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: victim.email, password: payload.password }),
    })
    expect(newLogin.ok, 'the issued password signs the member in')

    // ---- signing in by invite name must work without exposing the roster ----
    const byEmail = await call('/api/signin', null, { identifier: named.email, password: named.password })
    expect(byEmail.ok, 'an email signs in')

    const byName = await call('/api/signin', null, { identifier: named.username, password: named.password })
    const namePayload = await byName.json()
    expect(byName.ok && typeof namePayload.access_token === 'string', 'an invite name signs in')

    const upper = await call('/api/signin', null, { identifier: named.username.toUpperCase(), password: named.password })
    expect(upper.ok, 'an invite name is not case sensitive')

    const wrongPassword = await call('/api/signin', null, { identifier: named.username, password: 'not-the-password' })
    const wrongPayload = await wrongPassword.json()
    expect(wrongPassword.status === 400, 'a wrong password is refused')

    const unknownName = await call('/api/signin', null, { identifier: 'nobodyhere' + Date.now().toString(36).slice(-5), password: 'not-the-password' })
    const unknownPayload = await unknownName.json()
    expect(unknownPayload.error === wrongPayload.error,
      'an unknown invite name is indistinguishable from a wrong password')

    const scrape = JSON.stringify(unknownPayload) + JSON.stringify(wrongPayload) + JSON.stringify(namePayload)
    expect(!scrape.includes('@zenthos.test'), 'no response leaks a member email address')

    expect((await call('/api/signin', null, { identifier: named.username })).status === 400, 'a missing password is refused')


    // a receptionist may reach member rows, and nothing else
    const asDesk = (id, body) => fetch(URL + "/rest/v1/profiles?id=eq." + id, {
      method: "PATCH",
      headers: { apikey: PUBLISHABLE, Authorization: "Bearer " + desk.token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const readName = async id => (await (await service("/rest/v1/profiles?id=eq." + id + "&select=full_name,role")).json())[0]

    await asDesk(boss.id, { full_name: "Hijacked" })
    expect((await readName(boss.id)).full_name !== "Hijacked", "a receptionist cannot edit an admin profile")

    await asDesk(desk.id, { role: "admin" })
    expect((await readName(desk.id)).role === "receptionist", "a receptionist cannot promote themselves")
    // ---- the staff half of the identity rule has to work ----
    await fetch(URL + "/rest/v1/profiles?id=eq." + victim.id, {
      method: "PATCH",
      headers: { apikey: PUBLISHABLE, Authorization: "Bearer " + desk.token, "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: "Corrected Spelling" }),
    })
    const renamed = await (await service("/rest/v1/profiles?id=eq." + victim.id + "&select=full_name")).json()
    expect(renamed[0].full_name === "Corrected Spelling", "a receptionist can correct a member name")

    // ---- a forged Paystack reference must never confirm anything ----
    const forged = await call('/api/paystack/verify', member.token, {
      reference: 'zg_forged_' + Date.now(),
      payment_ids: ['00000000-0000-0000-0000-000000000000'],
    })
    expect(forged.status >= 400, 'an invented payment reference is refused')

    // ---- a garbage body must not crash a route into a 500 ----
    const junk = await fetch(APP + '/api/staff/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + desk.token },
      body: '{"user_id":',
    })
    expect(junk.status >= 400 && junk.status < 500, 'a malformed body is rejected without a server error')

    console.log('Verified (' + passed.length + '):')
    passed.forEach(item => console.log('  - ' + item))
    if (problems.length > 0) {
      console.log('\nProblems (' + problems.length + '):')
      problems.forEach(item => console.log('  - ' + item))
      process.exitCode = 1
    } else {
      console.log('\nNo route vulnerabilities found.')
    }
  } finally {
    for (const account of [member, desk, boss, victim, named]) {
      await service('/auth/v1/admin/users/' + account.id, { method: 'DELETE' })
    }
  }
})()
