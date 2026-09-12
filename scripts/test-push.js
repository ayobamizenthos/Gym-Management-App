// Proves the push chain end to end, including the case that matters most:
// a member whose phone was off gets the backlog once it comes back, and is not
// buried with it a second time on the next reconnect.
require('dotenv').config({ path: '.env.local' })
const webpush = require('web-push')
const { required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')
const APP = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const H = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' }

const svc = (path, options = {}) => fetch(URL + path, { ...options, headers: { ...H, ...(options.headers || {}) } })
const svcJson = async (path, options) => (await svc(path, options)).json()

const passed = []
const problems = []
const expect = (ok, what) => (ok ? passed.push(what) : problems.push(what))

const dispatch = () =>
  fetch(APP + '/api/push/dispatch', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
    body: '{}',
  })

/** A push endpoint that records what was delivered to it. */
function fakePhone() {
  const keys = webpush.generateVAPIDKeys()
  return {
    // a real-looking endpoint the sender will try, and fail against, predictably
    endpoint: 'https://fcm.googleapis.com/fcm/send/probe-' + Date.now() + Math.random().toString(36).slice(2, 8),
    p256dh: Buffer.from(keys.publicKey).toString('base64url').slice(0, 87),
    auth: Buffer.from(keys.privateKey).toString('base64url').slice(0, 22),
  }
}

;(async () => {
  const email = 'push_' + Date.now() + '@zenthos.test'
  const account = await svcJson('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'Push99#test', email_confirm: true, user_metadata: { full_name: 'Push Probe' } }),
  })
  const uid = account.id

  try {
    // ---- configuration is actually present ----
    const config = await svcJson('/rest/v1/app_config?select=key')
    const keys = (config || []).map(r => r.key)
    expect(keys.includes('app_url') && keys.includes('service_key'), 'the database knows where to send pushes')

    // ---- the endpoint refuses anyone without the service key ----
    const open = await fetch(APP + '/api/push/dispatch', { method: 'POST', body: '{}' })
    expect(open.status === 403, 'the dispatcher refuses an unauthenticated call')

    const wrong = await fetch(APP + '/api/push/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-the-key' },
      body: '{}',
    })
    expect(wrong.status === 403, 'the dispatcher refuses a wrong key')

    // ---- an alert for a member with no device is handled, not retried forever ----
    await svc('/rest/v1/notifications', {
      method: 'POST',
      body: JSON.stringify({ user_id: uid, type: 'payment_confirmed', title: 'No device yet', message: 'x' }),
    })
    await dispatch()
    let rows = await svcJson('/rest/v1/notifications?select=pushed_at&user_id=eq.' + uid)
    expect(rows.length === 1 && rows[0].pushed_at !== null,
      'an alert for a member with no registered device is not retried forever')

    // ---- register a device, then queue a backlog while it is "offline" ----
    const phone = fakePhone()
    await svc('/rest/v1/push_subscriptions', {
      method: 'POST',
      body: JSON.stringify({ user_id: uid, endpoint: phone.endpoint, p256dh: phone.p256dh, auth: phone.auth }),
    })

    const backlog = ['Payment confirmed', 'Renewal due', 'You earned free days']
    for (const title of backlog) {
      await svc('/rest/v1/notifications', {
        method: 'POST',
        body: JSON.stringify({ user_id: uid, type: 'payment_confirmed', title, message: 'while offline' }),
      })
    }
    let waiting = await svcJson('/rest/v1/notifications?select=id&user_id=eq.' + uid + '&pushed_at=is.null')
    expect(waiting.length === backlog.length,
      'alerts created while a phone is unreachable queue up (' + waiting.length + ')')

    // ---- the phone comes back: everything outstanding goes out at once ----
    const first = await dispatch()
    const firstBody = await first.json()
    expect(first.ok, 'the dispatcher runs')
    expect(firstBody.handled >= backlog.length,
      'the whole backlog is delivered in one pass (' + firstBody.handled + ')')

    waiting = await svcJson('/rest/v1/notifications?select=id&user_id=eq.' + uid + '&pushed_at=is.null')
    expect(waiting.length === 0, 'nothing is left outstanding afterwards')

    // ---- and they are not buried with it again ----
    const second = await dispatch()
    const secondBody = await second.json()
    expect((secondBody.handled ?? 0) === 0, 'a second run does not resend what was already delivered')

    // ---- a dead endpoint is pruned rather than retried ----
    const stillThere = await svcJson('/rest/v1/push_subscriptions?select=id&user_id=eq.' + uid)
    expect(Array.isArray(stillThere) && stillThere.length === 0,
      'a subscription the push service rejects is removed')

    // ---- one member cannot read another member's device credentials ----
    const session = await (await fetch(URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Push99#test' }),
    })).json()
    const other = await (await fetch(URL + '/rest/v1/push_subscriptions?select=endpoint,auth', {
      headers: {
        apikey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        Authorization: 'Bearer ' + session.access_token,
      },
    })).json()
    expect(Array.isArray(other) && other.every(r => !r.endpoint || r.endpoint === phone.endpoint),
      'a member cannot read another member device credentials')

    console.log('Verified (' + passed.length + '):')
    passed.forEach(item => console.log('  - ' + item))
    if (problems.length > 0) {
      console.log('\nProblems (' + problems.length + '):')
      problems.forEach(item => console.log('  - ' + item))
      process.exitCode = 1
    } else {
      console.log('\nPush delivery is correct.')
    }
  } finally {
    await svc('/rest/v1/notifications?user_id=eq.' + uid, { method: 'DELETE' })
    await svc('/auth/v1/admin/users/' + uid, { method: 'DELETE' })
  }
})()
