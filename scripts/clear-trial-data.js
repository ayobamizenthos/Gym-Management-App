// Wipes everything produced while trialling the app so the gym opens on a clean
// ledger: payments, visits, referrals, alerts, the audit trail and any uploaded
// proof of transfer. Accounts and the price list are left alone.
require('dotenv').config({ path: '.env.local' })
const { required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')

const headers = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' }
const call = (path, options = {}) => fetch(URL + path, { ...options, headers: { ...headers, ...(options.headers || {}) } })
const count = async (table) => ((await (await call('/rest/v1/' + table + '?select=id')).json()) || []).length

// child rows first - referrals and payments both point at profiles
const TABLES = ['notifications', 'audit_log', 'referrals', 'check_ins', 'payments']

;(async () => {
  for (const table of TABLES) {
    const before = await count(table)
    const res = await call('/rest/v1/' + table + '?id=not.is.null', { method: 'DELETE' })
    const after = await count(table)
    console.log(table.padEnd(14) + before + ' -> ' + after + (res.ok ? '' : '  (' + res.status + ')'))
  }

  // membership clocks and anything typed in while trialling reset with the ledger
  await call('/rest/v1/profiles?id=not.is.null', {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      expires_at: null,
      registration_paid: false,
      phone: null,
      address: null,
      emergency_contact: null,
      date_of_birth: null,
    }),
  })
  console.log('profiles       membership dates, joining fees and trial contact details cleared')

  // transfer screenshots belong to the payments that just went
  const files = await (await call('/storage/v1/object/list/proofs', {
    method: 'POST',
    body: JSON.stringify({ prefix: '', limit: 1000 }),
  })).json()
  if (Array.isArray(files) && files.length > 0) {
    const owned = []
    for (const entry of files) {
      const inner = await (await call('/storage/v1/object/list/proofs', {
        method: 'POST',
        body: JSON.stringify({ prefix: entry.name, limit: 1000 }),
      })).json()
      if (Array.isArray(inner) && inner.length > 0) inner.forEach(f => owned.push(entry.name + '/' + f.name))
      else owned.push(entry.name)
    }
    if (owned.length > 0) {
      await call('/storage/v1/object/proofs', { method: 'DELETE', body: JSON.stringify({ prefixes: owned }) })
    }
    console.log('proofs         ' + owned.length + ' file(s) removed')
  } else {
    console.log('proofs         nothing to remove')
  }

  const people = await (await call('/rest/v1/profiles?select=role,full_name,expires_at')).json()
  console.log('\nAccounts kept (' + people.length + '):')
  people.forEach(p => console.log('  ' + p.role.padEnd(13) + (p.full_name ?? '-')))
})()
