// Shared connection helper for the maintenance scripts.
// Credentials come from the environment - nothing is committed.
const { Client } = require('pg')

const required = name => {
  const value = process.env[name]
  if (!value) {
    console.error('Missing ' + name + '. Set it in .env.local or the shell before running.')
    process.exit(1)
  }
  return value
}

const connectionString = () => {
  const ref = required('SUPABASE_PROJECT_REF')
  const password = encodeURIComponent(required('SUPABASE_DB_PASSWORD'))
  const region = process.env.SUPABASE_DB_REGION || 'eu-west-2'
  return 'postgresql://postgres.' + ref + ':' + password + '@aws-0-' + region + '.pooler.supabase.com:6543/postgres'
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function connect(attempts = 20) {
  for (let i = 1; i <= attempts; i++) {
    const client = new Client({
      connectionString: connectionString(),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    })
    try {
      await client.connect()
      return client
    } catch {
      try { await client.end() } catch {}
      await sleep(4000)
    }
  }
  throw new Error('Could not reach the database after ' + attempts + ' attempts')
}

module.exports = { connect, required }
