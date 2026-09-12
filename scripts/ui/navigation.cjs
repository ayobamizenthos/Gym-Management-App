require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const { contextFor } = require('./session.cjs')

process.env.APP_URL = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const BASE = process.env.APP_URL

const results = []
const check = (ok, what) => { results.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }

const ROLES = [
  ['member', process.env.TEST_MEMBER, '/m', ['Home', 'Renew', 'Invite', 'Account']],
  ['desk', process.env.TEST_DESK, '/desk/overview', ['Overview', 'Members', 'Payments', 'More']],
  ['admin', process.env.TEST_ADMIN, '/admin', ['Overview', 'Members', 'Plans', 'More']],
]

;(async () => {
  const browser = await chromium.launch()

  for (const [role, email, home, labels] of ROLES) {
    const { context, page } = await contextFor(browser, role, email)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(BASE + home, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)

    // --- tab switching must not build a history trail to walk back through
    const before = await page.evaluate(() => window.history.length)
    for (const label of labels) {
      await page.click('nav.rounded-full a:has-text("' + label + '")')
      await page.waitForTimeout(900)
      const heading = await page.locator('h1').first().innerText().catch(() => '')
      check(heading.trim().length > 0, role + ': ' + label + ' opens a real page (' + heading.slice(0, 22) + ')')
    }
    const after = await page.evaluate(() => window.history.length)
    check(after === before, role + ': four tab switches add no history (' + before + ' -> ' + after + ')')

    // --- the raised action
    await page.locator('nav.rounded-full a[aria-label]').first().click()
    await page.waitForTimeout(1400)
    check(!page.url().includes('/login'), role + ': the centre action opens without bouncing to login')

    // --- the bell opens the inbox and closes it again
    await page.goto(BASE + home, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    const bell = page.locator('button[aria-expanded]').first()
    if (await bell.count()) {
      await bell.click()
      await page.waitForTimeout(1600)
      check(page.url().includes('/alerts'), role + ': the bell opens the inbox')
      await page.locator('button[aria-expanded]').first().click()
      await page.waitForTimeout(1600)
      check(!page.url().includes('/alerts'), role + ': tapping the bell again closes it')
    } else {
      check(false, role + ': has a bell')
    }

    check(errors.length === 0, role + ': no runtime errors' + (errors.length ? ' -> ' + errors[0].slice(0, 80) : ''))
    await context.close()
  }

  // --- a drill-down is one step, and Back returns to where it came from
  const { context, page } = await contextFor(browser, 'member', process.env.TEST_MEMBER)
  await page.goto(BASE + '/m/account', { waitUntil: 'domcontentloaded' })
  // the page has to be interactive or a Link reloads instead of routing
  await page.waitForSelector('main a[href="/m/history"]', { timeout: 30000 })
  await page.waitForTimeout(2500)
  // the bottom bar links there too, so reach for the one inside the page
  await page.locator('main a[href="/m/history"]').first().click()
  await page.waitForURL('**/m/history', { timeout: 30000 })
  await page.goBack()
  await page.waitForTimeout(2000)
  check(page.url().includes('/m/account'), 'Back from a drill-down returns to the tab it started on')
  await context.close()

  await browser.close()
  results.forEach(r => console.log(r))
})()
