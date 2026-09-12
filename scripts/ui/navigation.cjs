require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const BASE = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const results = []
const check = (ok, what) => { results.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }

async function signIn(page, email) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 45000 })
  await page.fill('form input:not([type="password"])', email)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 45000 }), page.click('button[type="submit"]')])
}

;(async () => {
  const browser = await chromium.launch()

  // --- tab switching must not build a history trail to walk back through
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await signIn(page, process.env.TEST_MEMBER)
  await page.waitForTimeout(1200)
  const startLen = await page.evaluate(() => window.history.length)
  for (const label of ['Payments', 'Alerts', 'Account', 'Home']) {
    await page.click('nav.rounded-full a:has-text("' + label + '")')
    await page.waitForTimeout(900)
  }
  const endLen = await page.evaluate(() => window.history.length)
  check(endLen === startLen, 'four tab switches add no history entries (' + startLen + ' -> ' + endLen + ')')
  check(page.url().endsWith('/m'), 'the last tab tapped is the page shown')

  // --- a drill-down is one step, and Back returns to where it came from
  await page.click('nav a:has-text("Account")')
  await page.waitForTimeout(900)
  await page.click('a:has-text("Payment history"), a[href="/m/history"]').catch(() => {})
  await page.waitForTimeout(1000)
  await page.goBack()
  await page.waitForTimeout(1000)
  check(page.url().includes('/m/account'), 'Back from a drill-down returns to the tab it started on')
  await ctx.close()

  // --- every bottom-nav destination must exist for each role
  for (const [who, email, labels] of [
    ['member', process.env.TEST_MEMBER, ['Home', 'Payments', 'Alerts', 'Account']],
    ['desk', process.env.TEST_DESK, ['Live', 'Members', 'Alerts', 'More']],
    ['admin', process.env.TEST_ADMIN, ['Overview', 'Members', 'Alerts', 'More']],
  ]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const p = await c.newPage()
    const errors = []
    p.on('pageerror', e => errors.push(e.message))
    await signIn(p, email)
    await p.waitForTimeout(1200)
    for (const label of labels) {
      await p.click('nav.rounded-full a:has-text("' + label + '")')
      await p.waitForTimeout(1000)
      const heading = await p.locator('h1').first().innerText().catch(() => '')
      check(heading.trim().length > 0, who + ': ' + label + ' opens a real page (' + heading.slice(0, 22) + ')')
    }
    // the raised action
    const action = await p.locator('nav.rounded-full a[aria-label]').first()
    await action.click()
    await p.waitForTimeout(1400)
    check(!p.url().includes('/login'), who + ': the centre action opens without bouncing to login')
    check(errors.length === 0, who + ': no runtime errors' + (errors.length ? ' -> ' + errors[0].slice(0, 90) : ''))
    await c.close()
  }

  await browser.close()
  results.forEach(r => console.log(r))
})()
