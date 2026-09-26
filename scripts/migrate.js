// Applies the SQL files listed on the command line, in order.
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { connect } = require('./db')

;(async () => {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('Usage: node scripts/migrate.js <file.sql> [...]')
    process.exit(1)
  }
  const client = await connect()
  let failed = 0
  for (const file of files) {
    try {
      await client.query(fs.readFileSync(file, 'utf8'))
      console.log('applied  ' + file)
    } catch (error) {
      failed++
      console.error('failed   ' + file + ' -> ' + error.message)
    }
  }
  await client.end()
  process.exit(failed ? 1 : 0)
})()
