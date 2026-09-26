// Proves the rules a gym actually runs on:
//   - days bought are held until the member first walks in
//   - the clock then runs on real dates, whether or not they keep showing up
//   - renewing early stacks onto what is left, it never resets it
require('dotenv').config({ path: '.env.local' })
const { required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')
const PUBLISHABLE = required('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const H = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' }
const svc = (path, options = {}) => fetch(URL + path, { ...options, headers: { ...H, ...(options.headers || {}) } })
const svcJson = async (path, options) => (await svc(path, options)).json()

const passed = []
const problems = []
const expect = (ok, what) => (ok ? passed.push(what) : problems.push(what))
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86_400_000)

async function member(name) {
  const email = 'life_' + Date.now() + Math.random().toString(36).slice(2, 6) + '@zenthos.test'
  const password = 'Life' + Math.random().toString(36).slice(2, 10) + '#9'
  const created = await svcJson('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name } }),
  })
  const session = await (await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })).json()
  return { id: created.id, token: session.access_token }
}

const asMember = (who, path, options = {}) =>
  fetch(URL + path, {
    ...options,
    headers: { apikey: PUBLISHABLE, Authorization: 'Bearer ' + who.token, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })

const profileOf = async id =>
  (await svcJson('/rest/v1/profiles?select=expires_at,pending_days,registration_paid&id=eq.' + id))[0]

/** Buys a plan for a member and confirms it, the way the desk would. */
async function buy(who, planId) {
  const [row] = await svcJson('/rest/v1/payments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: who.id, plan_id: planId, amount: 0, method: 'cash', status: 'pending' }),
  })
  await svcJson('/rest/v1/rpc/confirm_payment', { method: 'POST', body: JSON.stringify({ p_payment: row.id }) })
  return row.id
}

const scan = who => asMember(who, '/rest/v1/rpc/check_in', { method: 'POST', body: JSON.stringify({}) }).then(r => r.json())

;(async () => {
  const plans = await svcJson('/rest/v1/plans?select=id,name,duration_days,is_addon&is_active=eq.true&order=duration_days')
  const monthly = plans.find(p => !p.is_addon && p.duration_days >= 28 && p.duration_days <= 31)
  const short = plans.find(p => !p.is_addon && p.duration_days > 0 && p.duration_days < 28)
  if (!monthly) { console.log('No monthly plan to test with.'); process.exitCode = 1; return }

  const people = []
  try {
    // ---- 1. paying does not start the clock ----
    const a = await member('Pays Today'); people.push(a)
    await buy(a, monthly.id)
    let row = await profileOf(a.id)
    expect(row.expires_at === null && row.pending_days === monthly.duration_days,
      'paying holds the days instead of starting them (' + row.pending_days + ' held)')

    // ---- 2. the first scan starts it, and lets them in ----
    const first = await scan(a)
    expect(first.kind === 'valid', 'the first scan is accepted, not refused as no plan')
    row = await profileOf(a.id)
    expect(row.pending_days === 0, 'the held days are consumed by the first scan')
    expect(daysBetween(row.expires_at, new Date()) === monthly.duration_days,
      'the clock now runs ' + monthly.duration_days + ' real days from the first scan')

    // ---- 3. the clock runs on real dates, not on attendance ----
    const started = row.expires_at
    await scan(a)
    row = await profileOf(a.id)
    expect(row.expires_at === started, 'scanning again does not extend anything')

    // ---- 4. renewing early stacks, it never resets ----
    const before = row.expires_at
    await buy(a, monthly.id)
    row = await profileOf(a.id)
    expect(daysBetween(row.expires_at, before) === monthly.duration_days,
      'renewing early adds ' + monthly.duration_days + ' days onto the end')
    expect(new Date(row.expires_at) > new Date(before), 'renewing early never shortens what is left')
    expect(row.pending_days === 0, 'a renewal while running is not held back')

    // ---- 5. a second plan bought before the first is ever used stacks up too ----
    const b = await member('Pays Twice'); people.push(b)
    await buy(b, monthly.id)
    await buy(b, short ? short.id : monthly.id)
    row = await profileOf(b.id)
    const expected = monthly.duration_days + (short ? short.duration_days : monthly.duration_days)
    expect(row.expires_at === null && row.pending_days === expected,
      'two plans bought before starting are held together (' + row.pending_days + ' of ' + expected + ')')
    const opening = await scan(b)
    expect(opening.kind === 'valid' && opening.days_left === expected,
      'the first scan starts the whole balance at once (' + opening.days_left + ' days)')

    // ---- 6. an expired member is refused, and held days do not leak in ----
    const c = await member('Lapsed'); people.push(c)
    await svc('/rest/v1/profiles?id=eq.' + c.id, {
      method: 'PATCH',
      body: JSON.stringify({ expires_at: new Date(Date.now() - 86_400_000).toISOString() }),
    })
    const refused = await scan(c)
    expect(refused.kind === 'expired', 'a lapsed membership is refused at the door')

    // ---- 7. buying again after lapsing waits for the next scan ----
    await buy(c, monthly.id)
    row = await profileOf(c.id)
    expect(row.pending_days === monthly.duration_days, 'days bought after lapsing are held for the next scan')
    const back = await scan(c)
    expect(back.kind === 'valid', 'the returning member is let straight back in')
    row = await profileOf(c.id)
    expect(daysBetween(row.expires_at, new Date()) === monthly.duration_days,
      'their new clock starts today, not from the old expiry')

    console.log('Verified (' + passed.length + '):')
    passed.forEach(item => console.log('  - ' + item))
    if (problems.length) {
      console.log('\nProblems (' + problems.length + '):')
      problems.forEach(item => console.log('  - ' + item))
      process.exitCode = 1
    } else {
      console.log('\nMembership lifecycle is correct.')
    }
  } finally {
    for (const who of people) {
      await svc('/rest/v1/payments?user_id=eq.' + who.id, { method: 'DELETE' })
      await svc('/auth/v1/admin/users/' + who.id, { method: 'DELETE' })
    }
  }
})()
