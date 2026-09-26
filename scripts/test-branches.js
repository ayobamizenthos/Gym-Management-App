// A receptionist works one branch. Provisions a member in its branch and one in
// another, then checks what the desk can see and do with each.
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { required } = require('./db')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const client = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const out = []
const check = (ok, label) => out.push((ok ? 'PASS ' : 'FAIL ') + label)

;(async () => {
  const { data: desk } = await admin.from('profiles').select('id, branch_id').eq('email', process.env.TEST_DESK).single()
  const { data: other } = await admin.from('branches').select('id').neq('id', desk.branch_id).limit(1).single()
  const made = []
  const makeMember = async (label, branch) => {
    const email = 'branch.' + label + '.' + Date.now() + '@zenthosgym.com'
    const { data } = await admin.auth.admin.createUser({ email, password: 'Branch-check-2026', email_confirm: true, user_metadata: { full_name: 'Branch ' + label, phone: '08000000010' } })
    await admin.from('profiles').update({ branch_id: branch }).eq('id', data.user.id)
    made.push(data.user.id)
    return { id: data.user.id, email }
  }
  try {
    const mine = await makeMember('mine', desk.branch_id)
    const theirs = await makeMember('theirs', other.id)

    const reception = client()
    await reception.auth.signInWithPassword({ email: process.env.TEST_DESK, password: process.env.TEST_PASSWORD })
    const { data: seen } = await reception.from('profiles').select('id').in('id', [mine.id, theirs.id])
    const ids = (seen ?? []).map(r => r.id)
    check(ids.includes(mine.id), 'desk sees a member of its own branch')
    check(!ids.includes(theirs.id), 'desk cannot see a member of another branch')

    const upd = await reception.from('profiles').update({ address: 'changed' }).eq('id', theirs.id).select('id')
    check((upd.data ?? []).length === 0, "desk cannot edit another branch's member")

    const { data: plan } = await admin.from('plans').select('id').eq('is_active', true).eq('is_addon', false).limit(1).single()
    const theirPay = client()
    await theirPay.auth.signInWithPassword({ email: theirs.email, password: 'Branch-check-2026' })
    const req = await theirPay.rpc('request_payments', { p_plans: [plan.id], p_method: 'transfer', p_proof: null, p_branch: other.id })
    const payId = Array.isArray(req.data) ? req.data[0] : req.data
    const c = await reception.rpc('confirm_payment', { p_payment: payId })
    check(c.error?.message === 'not permitted', "desk cannot confirm another branch's payment (" + (c.error?.message ?? 'ALLOWED') + ')')
    const r = await reception.rpc('record_payment', { p_user: theirs.id, p_plan: plan.id, p_method: 'cash', p_reference: null, p_auto_confirm: true })
    check(!!r.error, "desk cannot record cash for another branch's member")
    const own = await reception.rpc('record_payment', { p_user: mine.id, p_plan: plan.id, p_method: 'cash', p_reference: null, p_auto_confirm: true })
    check(!own.error, 'desk can record cash for its own member' + (own.error ? ' (' + own.error.message + ')' : ''))

    const { data: alerts } = await admin.from('notifications').select('user_id, type, message').in('type', ['payment_pending', 'member_joined']).gte('created_at', new Date(Date.now() - 120000).toISOString())
    check(!(alerts ?? []).some(a => a.user_id === desk.id && a.type === 'payment_pending' && a.message.startsWith('Branch theirs')), "desk is not alerted about another branch's transfer")
    check((alerts ?? []).some(a => a.user_id === desk.id && a.type === 'member_joined'), 'desk is alerted when its own member first pays')

    const sum = await reception.rpc('admin_summary', { p_from: new Date(Date.now() - 86400000).toISOString(), p_to: new Date(Date.now() + 60000).toISOString() })
    check(!sum.error && sum.data.pending_payments === 0, 'desk overview counts only its own branch')

    const reset = await fetch(required('APP_URL') + '/api/staff/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await reception.auth.getSession()).data.session.access_token },
      body: JSON.stringify({ user_id: theirs.id }),
    }).then(res => res.status)
    check(reset === 403, "desk cannot reset another branch's password (" + reset + ')')
  } finally {
    for (const id of made) {
      await admin.from('check_ins').delete().eq('user_id', id)
      await admin.from('memberships').delete().eq('user_id', id)
      const { data: pays } = await admin.from('payments').select('id').eq('user_id', id)
      if (pays?.length) await admin.from('audit_log').delete().in('entity_id', pays.map(p => p.id))
      await admin.from('payments').delete().eq('user_id', id)
      await admin.from('notifications').delete().ilike('message', 'Branch %')
      await admin.from('notifications').delete().eq('user_id', id)
      await admin.from('audit_log').delete().eq('entity_id', id)
      await admin.auth.admin.deleteUser(id)
    }
    console.log(out.join('\n'))
    if (out.some(line => line.startsWith('FAIL'))) process.exitCode = 1
  }
})().catch(error => {
  console.log(out.join('\n'))
  console.error('ERROR', error.message)
  process.exitCode = 1
})
