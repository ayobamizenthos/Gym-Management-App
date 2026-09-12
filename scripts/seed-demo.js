// Fills the dashboard with plausible trading history so the charts have
// something to show during a walkthrough. Everything it writes is removed again
// by clear-trial-data.js, and nothing here should ever be presented as real.
require('dotenv').config({ path: '.env.local' })
const { required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')
const H = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' }

const DAYS = Number(process.argv[2] || 45)
const call = (path, options = {}) => fetch(URL + path, { ...options, headers: { ...H, ...(options.headers || {}) } })

;(async () => {
  const members = await (await call('/rest/v1/profiles?select=id,full_name&role=eq.member')).json()
  const plans = await (await call('/rest/v1/plans?select=id,price,duration_days,is_addon&is_active=eq.true')).json()
  if (!members.length || !plans.length) {
    console.log('Need at least one member and one active plan first.')
    process.exitCode = 1
    return
  }

  const payments = []
  const visits = []
  for (let day = 0; day < DAYS; day += 1) {
    const when = new Date(Date.now() - day * 86_400_000)
    // weekends are busier in a gym, and not every day takes money
    const busy = [0, 6].includes(when.getDay()) ? 3 : 2
    for (let n = 0; n < busy; n += 1) {
      if (Math.random() < 0.45) continue
      const member = members[Math.floor(Math.random() * members.length)]
      const plan = plans[Math.floor(Math.random() * plans.length)]
      const at = new Date(when)
      at.setHours(7 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60))
      payments.push({
        user_id: member.id,
        plan_id: plan.id,
        amount: plan.price,
        method: ['cash', 'transfer', 'paystack'][Math.floor(Math.random() * 3)],
        status: 'confirmed',
        created_at: at.toISOString(),
      })
      visits.push({ user_id: member.id, kind: 'valid', created_at: at.toISOString() })
    }
  }

  const wrote = await call('/rest/v1/payments', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payments),
  })
  const walked = await call('/rest/v1/check_ins', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(visits),
  })

  console.log('payments  ' + payments.length + (wrote.ok ? '' : '  (' + wrote.status + ')'))
  console.log('check-ins ' + visits.length + (walked.ok ? '' : '  (' + walked.status + ')'))
  console.log('\nRemove it all again with: node scripts/clear-trial-data.js')
})()
