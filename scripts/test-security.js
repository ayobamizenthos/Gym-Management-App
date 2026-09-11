// Adversarial suite. Signs in as a real member and attempts every escalation a
// hostile client could try. Ground truth is re-read with the service key so a
// blocked write is never mistaken for a blocked read.
require('dotenv').config({ path: '.env.local' })
const { required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')
const PUBLISHABLE = required('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const service = (path, options = {}) =>
  fetch(URL + path, {
    ...options,
    headers: { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
const serviceJson = async (path, options) => (await service(path, options)).json()

const blocked = []
const problems = []
const attack = (wasBlocked, description) => (wasBlocked ? blocked.push(description) : problems.push(description))

;(async () => {
  const email = 'attacker_' + Date.now() + '@zenthos.test'
  const account = await serviceJson('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'TestPass99#', email_confirm: true, user_metadata: { full_name: 'Attacker' } }),
  })
  const uid = account.id

  const session = await (await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass99#' }),
  })).json()

  const asMember = (path, options = {}) =>
    fetch(URL + path, {
      ...options,
      headers: { apikey: PUBLISHABLE, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
  const asMemberJson = async (path, options) => (await asMember(path, options)).json()

  try {
    const own = await asMemberJson('/rest/v1/profiles?select=id&id=eq.' + uid)
    if (Array.isArray(own) && own.length === 1) blocked.push('a member can read their own profile')
    else problems.push('a member cannot read their own profile')

    const plans = await asMemberJson('/rest/v1/plans?select=id,price')
    if (Array.isArray(plans) && plans.length > 0) blocked.push('a member can read the plan list')
    else problems.push('a member cannot read the plan list')

    const basePlan = await serviceJson('/rest/v1/plans?select=id,price&limit=1')
    const baseSettings = await serviceJson('/rest/v1/settings?select=registration_fee')

    await asMember('/rest/v1/profiles?id=eq.' + uid, { method: 'PATCH', body: JSON.stringify({ expires_at: '2030-01-01T00:00:00Z' }) })
    let truth = await serviceJson('/rest/v1/profiles?id=eq.' + uid + '&select=expires_at')
    attack(truth[0].expires_at === null, 'granting yourself membership time')

    await asMember('/rest/v1/profiles?id=eq.' + uid, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) })
    truth = await serviceJson('/rest/v1/profiles?id=eq.' + uid + '&select=role')
    attack(truth[0].role === 'member', 'promoting yourself to admin')

    await asMember('/rest/v1/profiles?id=eq.' + uid, { method: 'PATCH', body: JSON.stringify({ registration_paid: true }) })
    truth = await serviceJson('/rest/v1/profiles?id=eq.' + uid + '&select=registration_paid')
    attack(truth[0].registration_paid === false, 'waiving your own registration fee')

    const everyone = await asMemberJson('/rest/v1/profiles?select=id,full_name,phone')
    attack(Array.isArray(everyone) && everyone.length <= 1, 'harvesting the member database')

    const forged = await asMemberJson('/rest/v1/payments', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: uid, amount: 1, method: 'cash', status: 'confirmed' }),
    })
    attack(!(Array.isArray(forged) && forged.length > 0), 'writing a payment row directly')

    const rpc = await asMemberJson('/rest/v1/rpc/confirm_payment', {
      method: 'POST',
      body: JSON.stringify({ p_payment: '00000000-0000-0000-0000-000000000000' }),
    })
    attack(Boolean(rpc && (rpc.code || rpc.message)), 'calling the staff-only confirm function')

    const audit = await asMemberJson('/rest/v1/audit_log?select=id')
    attack(Array.isArray(audit) && audit.length === 0, 'reading the audit log')

    const checkIn = await asMemberJson('/rest/v1/check_ins', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: uid, kind: 'valid' }),
    })
    attack(!(Array.isArray(checkIn) && checkIn.length > 0), 'forging a check-in record')

    await asMember('/rest/v1/plans?id=eq.' + basePlan[0].id, { method: 'PATCH', body: JSON.stringify({ price: 1 }) })
    const plan = await serviceJson('/rest/v1/plans?id=eq.' + basePlan[0].id + '&select=price')
    attack(Number(plan[0].price) === Number(basePlan[0].price), 'rewriting plan pricing')

    await asMember('/rest/v1/settings?id=eq.true', { method: 'PATCH', body: JSON.stringify({ registration_fee: 0 }) })
    const settings = await serviceJson('/rest/v1/settings?select=registration_fee')
    attack(Number(settings[0].registration_fee) === Number(baseSettings[0].registration_fee), 'rewriting global settings')

    const removal = await asMember('/rest/v1/payments?user_id=neq.' + uid, { method: 'DELETE' })
    attack(removal.status >= 400, 'deleting other members payment history')

    console.log('Verified (' + blocked.length + '):')
    blocked.forEach(item => console.log('  - ' + item))
    if (problems.length > 0) {
      console.log('\nProblems (' + problems.length + '):')
      problems.forEach(item => console.log('  - ' + item))
      process.exitCode = 1
    } else {
      console.log('\nNo vulnerabilities found.')
    }
  } finally {
    await service('/auth/v1/admin/users/' + uid, { method: 'DELETE' })
  }
})()
