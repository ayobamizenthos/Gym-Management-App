// Verifies the money path end to end against the live schema.
// Creates throwaway accounts, asserts behaviour, then removes them.
require('dotenv').config({ path: '.env.local' })
const { connect, required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')

const api = (path, options = {}) =>
  fetch(URL + path, {
    ...options,
    headers: {
      apikey: SECRET,
      Authorization: 'Bearer ' + SECRET,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

const createUser = async (tag, meta = {}) => {
  const email = 'test_' + tag + '_' + Date.now() + '@zenthos.test'
  const res = await (await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'TestPass99#', email_confirm: true, user_metadata: meta }),
  })).json()
  if (!res.id) throw new Error('could not create ' + tag)
  return res.id
}

const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

;(async () => {
  const client = await connect()
  const created = []
  try {
    const query = async (sql, params) => (await client.query(sql, params)).rows

    const [{ id: admin }] = await query("select id from profiles where role='admin' limit 1")
    await query(
      "select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, false)",
      [admin]
    )

    const [{ id: branch }] = await query('select id from branches limit 1')
    const [{ id: monthly }] = await query("select id from plans where duration_days = 30 limit 1")
    const [{ id: addon }] = await query('select id from plans where is_addon limit 1')

    const referrer = await createUser('ref', { full_name: 'Test Referrer' })
    const first = await createUser('m1', { full_name: 'Test One' })
    const second = await createUser('m2', { full_name: 'Test Two' })
    const third = await createUser('m3', { full_name: 'Test Three' })
    created.push(referrer, first, second, third)

    await query('update profiles set referred_by = $1, branch_id = $2 where id = any($3)', [referrer, branch, [first, second, third]])
    await query(
      'insert into referrals (referrer_id, referred_id) values ($1,$2),($1,$3),($1,$4) on conflict do nothing',
      [referrer, first, second, third]
    )

    const pay = async (user, plan, registration = false) => {
      const [{ id }] = await query(
        'insert into payments (user_id, plan_id, branch_id, amount, method, status, includes_registration) values ($1,$2,$3,$4,$5,$6,$7) returning id',
        [user, plan, branch, 0, 'cash', 'pending', registration]
      )
      await query('select public.confirm_payment($1)', [id])
      return id
    }

    await pay(first, monthly, true)
    let [row] = await query('select expires_at, pending_days, registration_paid from profiles where id = $1', [first])
    expect(row.pending_days === 30, 'a monthly plan did not hold 30 days for the first scan')

    // Walking in starts the clock. check_in itself is covered end to end in
    // test-lifecycle.js; here we only need the clock running to test the maths.
    await query(
      'update profiles set expires_at = now() + make_interval(days => pending_days), pending_days = 0 where id = $1',
      [first]
    )
    ;[row] = await query('select expires_at, pending_days, registration_paid from profiles where id = $1', [first])
    expect(row.pending_days === 0 && row.expires_at && new Date(row.expires_at) > new Date(Date.now() + 29 * 864e5),
      'the first scan did not start the 30 days')
    expect(row.registration_paid === true, 'the registration flag was not set')
    const afterFirst = new Date(row.expires_at)

    const renewal = await pay(first, monthly)
    ;[row] = await query('select expires_at from profiles where id = $1', [first])
    expect(new Date(row.expires_at) > new Date(afterFirst.getTime() + 29 * 864e5), 'a renewal reset the clock instead of stacking')

    let doubleConfirmed = false
    try { await query('select public.confirm_payment($1)', [renewal]); doubleConfirmed = true } catch {}
    expect(!doubleConfirmed, 'a confirmed payment could be confirmed twice')

    ;[row] = await query('select expires_at, pending_days from profiles where id = $1', [referrer])
    expect(row.expires_at === null && row.pending_days === 0, 'the referrer was rewarded before the target was met')

    await pay(second, monthly, true)
    ;[row] = await query('select expires_at, pending_days from profiles where id = $1', [referrer])
    expect(row.expires_at === null && row.pending_days === 0, 'the referrer was rewarded on the second referral')

    await pay(third, monthly, true)
    ;[row] = await query('select expires_at, pending_days from profiles where id = $1', [referrer])
    expect(row.pending_days === 7, 'the referrer was not given 7 free days on the third referral')

    // a walk-in is not joining, so it must never attract the joining fee
    const walkIn = await createUser('walk', { full_name: 'Test Walk' })
    created.push(walkIn)
    const [{ id: walkPlan }] = await query("select id from plans where requires_registration = false and not is_addon limit 1")
    const walkId = await query("select public.record_payment($1,$2,$3,null,false) as id", [walkIn, walkPlan, 'cash'])
    const [walkPay] = await query("select amount, includes_registration from payments where id = $1", [walkId[0].id])
    expect(walkPay.includes_registration === false, 'a walk-in was charged the joining fee')
    expect(Number(walkPay.amount) === 2000, 'walk-in amount was ' + walkPay.amount + ' instead of 2000')
    const [before] = await query('select expires_at from profiles where id = $1', [first])
    await pay(first, addon)
    const [after] = await query('select expires_at from profiles where id = $1', [first])
    expect(String(before.expires_at) === String(after.expires_at), 'an add-on extended the membership')

    console.log(failures.length === 0
      ? 'All logic tests passed.'
      : 'Failures:\n - ' + failures.join('\n - '))
    process.exitCode = failures.length === 0 ? 0 : 1
  } catch (error) {
    console.error('Test run error:', error.message)
    process.exitCode = 1
  } finally {
    for (const id of created) await api('/auth/v1/admin/users/' + id, { method: 'DELETE' })
    await client.end()
  }
})()
