// Read-only stocktake of what is actually in the database.
require('dotenv').config({ path: '.env.local' })
const { required } = require('./db')

const URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SECRET = required('SUPABASE_SECRET_KEY')

const get = async (path) =>
  (await fetch(URL + path, {
    headers: { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
  })).json()

;(async () => {
  for (const table of ['payments', 'check_ins', 'referrals', 'notifications', 'audit_log']) {
    const rows = await get('/rest/v1/' + table + '?select=id')
    console.log(table.padEnd(14) + (Array.isArray(rows) ? rows.length : JSON.stringify(rows)))
  }

  const people = await get('/rest/v1/profiles?select=id,full_name,email,role,expires_at,registration_paid,created_at&order=created_at')
  console.log('\nprofiles (' + people.length + ')')
  for (const p of people) {
    console.log(
      '  ' + (p.role ?? '?').padEnd(13) +
      (p.full_name ?? '-').padEnd(22) +
      (p.email ?? '-').padEnd(42) +
      'expires=' + (p.expires_at ? p.expires_at.slice(0, 10) : 'none') +
      ' fee=' + (p.registration_paid ? 'paid' : 'no')
    )
  }

  const buckets = await get('/storage/v1/bucket')
  if (Array.isArray(buckets)) {
    for (const b of buckets) {
      const files = await (await fetch(URL + '/storage/v1/object/list/' + b.name, {
        method: 'POST',
        headers: { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: '', limit: 100 }),
      })).json()
      console.log('\nstorage/' + b.name + ' (' + (Array.isArray(files) ? files.length : '?') + ')')
      if (Array.isArray(files)) files.forEach(f => console.log('  ' + f.name))
    }
  }
})()
