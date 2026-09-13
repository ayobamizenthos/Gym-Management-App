require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const { ensureMember } = require('./session.cjs')
const BASE = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const out = []
const check = (ok, what) => { out.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }

async function signIn(page, email) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 45000 })
  await page.fill('form input:not([type="password"])', email)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 45000 }), page.click('button[type="submit"]')])
}

// a real finger drag across the bar, not a synthetic click
async function drag(page, dx) {
  const bar = await page.locator('nav.rounded-full').boundingBox()
  const y = Math.round(bar.y + bar.height / 2)
  const startX = dx < 0 ? Math.round(bar.x + bar.width - 24) : Math.round(bar.x + 24)
  await page.evaluate(([sx, sy, d]) => {
    const nav = document.querySelector('nav.rounded-full')
    const make = (type, x) => new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: nav, clientX: x, clientY: sy })],
      changedTouches: [new Touch({ identifier: 1, target: nav, clientX: x, clientY: sy })],
    })
    nav.dispatchEvent(make('touchstart', sx))
    nav.dispatchEvent(make('touchmove', sx + d / 2))
    nav.dispatchEvent(make('touchend', sx + d))
  }, [startX, y, dx])
  await page.waitForTimeout(1600)
}

;(async () => {
  // the session-based suites delete the member when they finish, so make
  // sure there is one before signing in as them
  await ensureMember()
  const b = await chromium.launch()
  for (const [who, email, dash] of [
    ['admin', process.env.TEST_ADMIN, '/admin'],
    ['receptionist', process.env.TEST_DESK, '/desk/overview'],
  ]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const p = await c.newPage()
    await signIn(p, email)
    await p.goto(BASE + dash, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('nav.rounded-full', { timeout: 30000 })
    await p.waitForTimeout(2500)

    await drag(p, 120)                       // left to right
    check(p.url().includes('/m'), who + ': swiping right off the dashboard opens the member view (' + p.url().replace(BASE, '') + ')')

    await drag(p, -120)                      // right to left
    check(p.url().includes(dash), who + ': swiping left from the member view returns to their dashboard (' + p.url().replace(BASE, '') + ')')
    await c.close()
  }

  // a member has no second workspace, so nothing should move
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const p = await c.newPage()
  await signIn(p, process.env.TEST_MEMBER)
  await p.goto(BASE + '/m', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('nav.rounded-full', { timeout: 30000 })
  await p.waitForTimeout(2500)
  await drag(p, -120)
  check(p.url().endsWith('/m'), 'member: swiping does nothing')
  await c.close()

  await b.close()
  out.forEach(r => console.log(r))
})()
