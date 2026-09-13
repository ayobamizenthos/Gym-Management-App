require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')

const BASE = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY
const H = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' }
const svc = (path, options = {}) => fetch(SB + path, { ...options, headers: { ...H, ...(options.headers || {}) } })

const out = []
const check = (ok, what) => { out.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }

async function signIn(page, email) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 45000 })
  await page.fill('form input:not([type="password"])', email)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 45000 }), page.click('button[type="submit"]')])
}

/** A real finger: many small steps, not one teleport the browser ignores. */
async function drag(page, from, to, y) {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] })
  const steps = 14
  for (let i = 1; i <= steps; i += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from + ((to - from) * i) / steps, y }],
    })
    await page.waitForTimeout(12)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  // ---------------------------------------------------------- the swipe ----
  await signIn(page, process.env.TEST_ADMIN)
  await page.goto(BASE + '/m', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const bar = await page.locator('nav.rounded-full').boundingBox()
  check(Boolean(bar), 'the bar is on screen')
  const touchAction = await page.evaluate(() => getComputedStyle(document.querySelector('nav.rounded-full')).touchAction)
  check(/pan-y/.test(touchAction), 'the bar claims the horizontal drag (touch-action: ' + touchAction + ')')

  const midY = bar.y + bar.height / 2
  await drag(page, bar.x + bar.width - 40, bar.x + 40, midY)
  await page.waitForTimeout(2200)
  check(page.url().includes('/admin'), 'swiping left crosses to the dashboard (' + page.url().replace(BASE, '') + ')')

  await page.waitForTimeout(800)
  const bar2 = await page.locator('nav.rounded-full').boundingBox()
  await drag(page, bar2.x + 40, bar2.x + bar2.width - 40, bar2.y + bar2.height / 2)
  await page.waitForTimeout(2200)
  check(page.url().includes('/m'), 'swiping right crosses back to the membership (' + page.url().replace(BASE, '') + ')')

  // a short drag is a tap that wandered, not a switch
  const bar3 = await page.locator('nav.rounded-full').boundingBox()
  const before = page.url()
  await drag(page, bar3.x + bar3.width / 2, bar3.x + bar3.width / 2 - 24, bar3.y + bar3.height / 2)
  await page.waitForTimeout(1200)
  check(page.url() === before, 'a short drag changes nothing')

  // ------------------------------------------------------- the birthday ----
  const born = new Date()
  const celebrantEmail = 'bday_' + Date.now() + '@zenthos.test'
  const celebrant = await (await svc('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: celebrantEmail, password: 'Bday99#test', email_confirm: true,
      user_metadata: { full_name: 'Amaka Eze', username: 'amaka' + String(Date.now()).slice(-5) },
    }),
  })).json()

  const [me] = await (await svc('/rest/v1/profiles?select=id,branch_id&email=eq.' + process.env.TEST_ADMIN)).json()
  await svc('/rest/v1/profiles?id=eq.' + celebrant.id, {
    method: 'PATCH',
    body: JSON.stringify({
      date_of_birth: born.toISOString().slice(0, 10),
      expires_at: new Date(Date.now() + 20 * 86400000).toISOString(),
      branch_id: me.branch_id,
    }),
  })
  await svc('/rest/v1/profiles?id=eq.' + me.id, {
    method: 'PATCH',
    body: JSON.stringify({ expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), pending_days: 0 }),
  })

  await svc('/rest/v1/check_ins?user_id=eq.' + me.id, { method: 'DELETE' })
  await svc('/rest/v1/notifications?user_id=eq.' + me.id, { method: 'DELETE' })

  await page.goto(BASE + '/checkin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3200)

  const body = await page.locator('body').innerText()
  check(/ACCESS GRANTED/i.test(body), 'the scan succeeds')
  check(/happy birthday/i.test(body), 'the birthday card appears after a successful scan')
  check(/Amaka/.test(body), 'it names the celebrant with a capital (' + (body.match(/Wish \w+/) || [''])[0] + ')')

  const card = await page.locator('[data-card="birthday"]').boundingBox()
  check(Boolean(card) && card.height > 40 && card.height < 140, 'it is a small card, not a takeover (' + Math.round(card ? card.height : 0) + 'px)')

  await page.screenshot({ path: './.ui-shots/birthday.png' })

  await page.locator('[data-card="birthday"] button[aria-label="Close"]').click()
  await page.waitForTimeout(700)
  check(!/happy birthday/i.test(await page.locator('body').innerText()), 'closing it dismisses it')

  // a member at another branch must not see them
  const otherBranch = await (await svc('/rest/v1/branches?select=id&limit=1')).json()
  await svc('/rest/v1/profiles?id=eq.' + celebrant.id, {
    method: 'PATCH',
    body: JSON.stringify({ branch_id: otherBranch[0] && otherBranch[0].id === me.branch_id ? null : (otherBranch[0] || {}).id ?? null }),
  })
  const elsewhere = await (await fetch(SB + '/rest/v1/rpc/birthdays_today', {
    method: 'POST', headers: H, body: JSON.stringify({ p_branch: me.branch_id }),
  })).json()
  check(Array.isArray(elsewhere) && !elsewhere.some(r => /amaka/i.test(r.username || '')),
    'a celebrant at another branch is not shown')

  check(errs.length === 0, 'no runtime errors' + (errs.length ? ' -> ' + errs[0].slice(0, 90) : ''))

  await browser.close()
  await svc('/rest/v1/notifications?user_id=eq.' + celebrant.id, { method: 'DELETE' })
  await svc('/auth/v1/admin/users/' + celebrant.id, { method: 'DELETE' })
  out.forEach(r => console.log(r))
})()
