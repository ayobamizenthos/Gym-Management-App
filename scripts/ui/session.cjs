const fs = require('fs')
const path = require('path')

const CACHE = path.join(__dirname, '..', '..', '.ui-shots', 'sessions')

const SB = () => process.env.NEXT_PUBLIC_SUPABASE_URL
const H = () => ({
  apikey: process.env.SUPABASE_SECRET_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_SECRET_KEY,
  'Content-Type': 'application/json',
})

/**
 * The member account these suites drive is created on demand and destroyed
 * afterwards, so a real gym is never left with a test member sitting in its
 * list. Staff accounts belong to the gym and are only signed into.
 */
async function ensureMember() {
  const email = process.env.TEST_MEMBER
  const [existing] = await (await fetch(SB() + '/rest/v1/profiles?select=id&email=eq.' + email, { headers: H() })).json()
  if (existing) return existing.id

  const created = await (await fetch(SB() + '/auth/v1/admin/users', {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      email,
      password: process.env.TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Suite Member', phone: '08000000001', username: 'suite' },
    }),
  })).json()
  return created.id
}

async function removeMember() {
  const email = process.env.TEST_MEMBER
  const [row] = await (await fetch(SB() + '/rest/v1/profiles?select=id&email=eq.' + email, { headers: H() })).json()
  if (!row) return
  await fetch(SB() + '/rest/v1/payments?user_id=eq.' + row.id, { method: 'DELETE', headers: H() })
  await fetch(SB() + '/auth/v1/admin/users/' + row.id, { method: 'DELETE', headers: H() })
  fs.rmSync(path.join(CACHE, 'member.json'), { force: true })
}

/**
 * Signing in is rate limited, and a suite that signs in for every assertion will
 * eventually be told to wait rather than told the truth. Each role signs in once
 * and the browser state is reused until it stops working.
 */
async function contextFor(browser, role, email, options = {}) {
  if (role === 'member') await ensureMember()

  fs.mkdirSync(CACHE, { recursive: true })
  const file = path.join(CACHE, role + '.json')
  const base = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...options }

  if (fs.existsSync(file)) {
    const context = await browser.newContext({ ...base, storageState: file })
    const page = await context.newPage()
    await page.goto(process.env.APP_URL + '/m', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1200)
    if (!page.url().includes('/login')) return { context, page }
    await context.close()
    fs.rmSync(file, { force: true })
  }

  const context = await browser.newContext(base)
  const page = await context.newPage()
  await page.goto(process.env.APP_URL + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 90000 })
  await page.fill('form input:not([type="password"])', email)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await Promise.all([
    page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 90000 }),
    page.click('button[type="submit"]'),
  ])
  await context.storageState({ path: file })
  return { context, page }
}

module.exports = { contextFor, ensureMember, removeMember }
