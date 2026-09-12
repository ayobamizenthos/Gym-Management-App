require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const BASE = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY
const H = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' }

const results = []
const check = (ok, what) => { results.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }
const ago = mins => new Date(Date.now() - mins * 60000).toISOString()

;(async () => {
  const [me] = await (await fetch(SB + '/rest/v1/profiles?select=id&email=eq.' + process.env.TEST_MEMBER + '', { headers: H })).json()
  await fetch(SB + '/rest/v1/notifications?user_id=eq.' + me.id, { method: 'DELETE', headers: H })

  const seed = [
    { type: 'payment_pending', title: 'Transfer received', message: 'Waiting on the desk.', created_at: ago(5) },
    { type: 'payment_pending', title: 'Transfer received', message: 'Waiting on the desk.', created_at: ago(6) },
    { type: 'payment_pending', title: 'Transfer received', message: 'Waiting on the desk.', created_at: ago(7) },
    { type: 'payment_confirmed', title: 'Payment confirmed', message: '30 days added.', created_at: ago(30) },
    { type: 'payment_rejected', title: 'Payment rejected', message: 'Amount did not match.', created_at: ago(60) },
    { type: 'referral_reward', title: 'You earned 7 free days', message: 'Three friends paid.', created_at: ago(60 * 30) },
    { type: 'renewals_due', title: 'Renewal due', message: 'Five days left.', created_at: ago(60 * 24 * 2) },
  ].map(n => ({ ...n, user_id: me.id }))
  const inserted = await fetch(SB + '/rest/v1/notifications', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(seed) })
  check(inserted.ok, 'seeded ' + seed.length + ' alerts')

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 45000 })
  await page.fill('form input:not([type="password"])', process.env.TEST_MEMBER)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 45000 }), page.click('button[type="submit"]')])
  await page.waitForTimeout(2500)

  const badge = await page.locator('button[aria-expanded] span').first().innerText().catch(() => '')
  check(badge.trim() === '7', 'the bell badge shows every unread alert (' + badge.trim() + ')')

  await page.goto(BASE + '/m/alerts', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const body = await page.locator('body').innerText()

  check(/Today/i.test(body), 'alerts are grouped under Today')
  check(/this week|yesterday/i.test(body), 'older alerts sit in their own group')
  check(/\+2/.test(body), 'three identical alerts collapse into one line with +2')
  check(/Payments/i.test(body) && /Rewards/i.test(body), 'family filters appear for the kinds present')
  check(/7 unread/.test(body), 'the unread count is stated')

  // filtering narrows to one family
  await page.getByRole('button', { name: 'Rewards', exact: true }).click()
  await page.waitForTimeout(700)
  const filtered = await page.locator('body').innerText()
  check(/free days/i.test(filtered) && !/Transfer received/.test(filtered), 'a family filter narrows the list')
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.waitForTimeout(600)

  await page.getByRole('button', { name: 'Mark all read' }).click()
  await page.waitForTimeout(2200)
  const after = await page.locator('body').innerText()
  check(/Nothing unread/.test(after), 'marking all read clears the count')

  const truth = await (await fetch(SB + '/rest/v1/notifications?select=is_read&user_id=eq.' + me.id, { headers: H })).json()
  check(Array.isArray(truth) && truth.every(n => n.is_read === true), 'the database really recorded them as read')

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  check(/Nothing unread/.test(await page.locator('body').innerText()), 'it stays read after a reload')
  check(errors.length === 0, 'no runtime errors' + (errors.length ? ' -> ' + errors[0].slice(0, 90) : ''))

  await browser.close()
  await fetch(SB + '/rest/v1/notifications?user_id=eq.' + me.id, { method: 'DELETE', headers: H })
  results.forEach(r => console.log(r))
})()
