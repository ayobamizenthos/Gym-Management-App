// The app these suites drive. There is deliberately no default: pointing a
// suite at the live site has to be a decision, not an accident.
const base = process.env.APP_URL
if (!base) {
  console.error('Set APP_URL, e.g. APP_URL=http://localhost:3000 after `npm run build && npx next start`.')
  process.exit(1)
}
module.exports = base.replace(/\/$/, '')
