const fs = require('fs')
const path = require('path')

const CACHE = path.join(__dirname, '..', '..', '.ui-shots', 'sessions')

/**
 * Signing in is rate limited, and a suite that signs in for every assertion will
 * eventually be told to wait rather than told the truth. Each role signs in once
 * and the browser state is reused until it stops working.
 */
async function contextFor(browser, role, email, options = {}) {
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

module.exports = { contextFor }
