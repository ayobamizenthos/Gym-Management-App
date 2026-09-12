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

    // ---- identity is staff-maintained; contact details stay the member's ----
    await asMember('/rest/v1/profiles?id=eq.' + uid, { method: 'PATCH', body: JSON.stringify({ full_name: 'Somebody Else' }) })
    truth = await serviceJson('/rest/v1/profiles?id=eq.' + uid + '&select=full_name')
    attack(truth[0].full_name === 'Attacker', 'renaming yourself to match another member')

    await asMember('/rest/v1/profiles?id=eq.' + uid, { method: 'PATCH', body: JSON.stringify({ date_of_birth: '1900-01-01' }) })
    truth = await serviceJson('/rest/v1/profiles?id=eq.' + uid + '&select=date_of_birth')
    attack(truth[0].date_of_birth === null, 'rewriting your own date of birth')

    await asMember('/rest/v1/profiles?id=eq.' + uid, { method: 'PATCH', body: JSON.stringify({ username: 'stolenhandle' }) })
    truth = await serviceJson('/rest/v1/profiles?id=eq.' + uid + '&select=username')
    attack(truth[0].username === null, 'claiming an invite name by direct write')

    // the legitimate half has to keep working, or the app is broken
    await asMember('/rest/v1/profiles?id=eq.' + uid, {
      method: 'PATCH',
      body: JSON.stringify({ phone: '08030000001', address: '12 Allen Avenue', emergency_contact: 'Sister 08030000002' }),
    })
    truth = await serviceJson('/rest/v1/profiles?id=eq.' + uid + '&select=phone,address,emergency_contact')
    if (truth[0].phone === '08030000001' && truth[0].address === '12 Allen Avenue' && truth[0].emergency_contact === 'Sister 08030000002') {
      blocked.push('a member can still keep their own contact details current')
    } else {
      problems.push('LEGIT: a member cannot update their own contact details')
    }

    // ---- an inbox you can mark read but not rewrite ----
    const alert = (await serviceJson("/rest/v1/notifications", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: uid, type: "payment_rejected", title: "Payment rejected", message: "Wrong amount" }) }))[0]
    await asMember("/rest/v1/notifications?id=eq." + alert.id, { method: "PATCH", body: JSON.stringify({ title: "Payment confirmed", message: "All good" }) })
    truth = await serviceJson("/rest/v1/notifications?id=eq." + alert.id + "&select=title,message,is_read")
    attack(truth[0].title === "Payment rejected" && truth[0].message === "Wrong amount", "rewriting an alert you received")

    await asMemberJson("/rest/v1/rpc/mark_notifications_read", { method: "POST", body: JSON.stringify({ p_ids: [alert.id] }) })
    truth = await serviceJson("/rest/v1/notifications?id=eq." + alert.id + "&select=is_read")
    if (truth[0].is_read === true) blocked.push("a member can mark their own alert read")
    else problems.push("LEGIT: a member cannot mark their own alert read")

    const otherInbox = await asMemberJson("/rest/v1/notifications?select=id,title&user_id=neq." + uid)
    attack(Array.isArray(otherInbox) && otherInbox.length === 0, "reading another member inbox")

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


    // ---- multi-plan checkout: the amount must be re-derived server side ----
    const allPlans = await serviceJson('/rest/v1/plans?select=id,name,price,is_addon,requires_registration&is_active=eq.true')
    const membership = allPlans.find(p => !p.is_addon)
    const addon = allPlans.find(p => p.is_addon)

    // stacking several membership plans in one checkout must be refused
    const stacked = await asMemberJson('/rest/v1/rpc/request_payments', {
      method: 'POST',
      body: JSON.stringify({
        p_plans: allPlans.filter(p => !p.is_addon).slice(0, 2).map(p => p.id),
        p_method: 'transfer',
      }),
    })
    attack(Boolean(stacked && (stacked.code || stacked.message)), 'stacking two membership plans in one checkout')

    // an add-on with no membership must be refused
    if (addon) {
      const addonOnly = await asMemberJson('/rest/v1/rpc/request_payments', {
        method: 'POST',
        body: JSON.stringify({ p_plans: [addon.id], p_method: 'transfer' }),
      })
      attack(Boolean(addonOnly && (addonOnly.code || addonOnly.message)), 'buying an add-on with no membership')
    }

    // a legitimate checkout must price itself from the plan, not the client
    const legit = await asMemberJson('/rest/v1/rpc/request_payments', {
      method: 'POST',
      body: JSON.stringify({
        p_plans: addon ? [membership.id, addon.id] : [membership.id],
        p_method: 'transfer',
      }),
    })
    if (Array.isArray(legit) && legit.length > 0) {
      const created = await serviceJson('/rest/v1/payments?id=in.(' + legit.join(',') + ')&select=id,amount,status,includes_registration')
      const joiningFee = Number((await serviceJson('/rest/v1/settings?select=registration_fee'))[0].registration_fee)
      const expected =
        Number(membership.price) +
        (addon ? Number(addon.price) : 0) +
        (membership.requires_registration ? joiningFee : 0)
      const charged = created.reduce((sum, r) => sum + Number(r.amount), 0)
      attack(charged === expected, 'checkout priced at ' + charged + ' instead of ' + expected)
      attack(created.every(r => r.status === 'pending'), 'checkout rows created already confirmed')
      const feeRows = created.filter(r => r.includes_registration).length
      attack(feeRows <= 1, 'joining fee applied ' + feeRows + ' times in one checkout')
      await service('/rest/v1/payments?id=in.(' + legit.join(',') + ')', { method: 'DELETE' })
    } else {
      problems.push('LEGIT: a valid checkout was rejected')
    }

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
