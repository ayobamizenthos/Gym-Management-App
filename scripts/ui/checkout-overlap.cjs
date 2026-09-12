require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const BASE = process.env.APP_URL || 'http://127.0.0.1:4316'

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-15', width: 390, height: 844 },
  { name: 'short-window', width: 1005, height: 692 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'very-short', width: 390, height: 560 },
]

const overlap = (a, b) => {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return Math.round(x * y)
}

;(async () => {
  const browser = await chromium.launch()
  let failures = 0

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 700, hasTouch: vp.width < 700 })
    const page = await ctx.newPage()
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('button[type="submit"]:not([disabled])')
    await page.fill('form input:not([type="password"])', process.env.TEST_MEMBER)
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
    await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login')), page.click('button[type="submit"]')])

    await page.goto(BASE + '/m/renew', { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)

    // pick the plan that triggers the joining-fee line, the tallest bar state
    await page.click('li:has-text("3 Months") button')
    await page.waitForTimeout(600)

    // scroll to the very bottom, which is where the user ends up
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    const result = await page.evaluate(() => {
      const bar = [...document.querySelectorAll('div')].find(d => { const pos = getComputedStyle(d).position; return (pos === 'fixed' || pos === 'sticky') && d.textContent.trim().startsWith('Total') })
      const buttons = [...document.querySelectorAll('button')].filter(b => /^(Card|Transfer)$/.test(b.textContent.trim()))
      const nav = document.querySelector('nav[aria-label="Main"]')
      const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height) } }
      return {
        bar: bar ? box(bar) : null,
        nav: nav ? box(nav) : null,
        buttons: buttons.map(b => ({ label: b.textContent.trim(), ...box(b) })),
        docHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        scrolledTo: Math.round(window.scrollY),
      }
    })

    if (!result.bar) { console.log(vp.name.padEnd(14) + 'FAIL no totals bar found'); failures++; await ctx.close(); continue }
    if (result.buttons.length !== 2) { console.log(vp.name.padEnd(14) + 'FAIL pay buttons not found'); failures++; await ctx.close(); continue }

    let worst = 0
    const details = result.buttons.map(b => {
      const px = overlap(b, result.bar)
      worst = Math.max(worst, px)
      return b.label + (px > 0 ? ' COVERED(' + px + 'px2)' : ' clear')
    })
    // the bar must also clear the bottom nav
    const navOverlap = result.nav ? overlap(result.bar, result.nav) : 0

    const ok = worst === 0 && navOverlap === 0
    if (!ok) failures++
    console.log(
      vp.name.padEnd(14) + (ok ? 'ok   ' : 'FAIL ') +
      details.join(' | ') +
      '  bar=' + result.bar.top + '-' + result.bar.bottom +
      (navOverlap ? '  BAR OVER NAV(' + navOverlap + ')' : '') +
      '  doc=' + result.docHeight + ' vh=' + result.viewportHeight
    )
    await ctx.close()
  }

  await browser.close()
  console.log(failures === 0 ? '\nNothing is covered.' : '\n' + failures + ' viewport(s) with a covered control.')
  process.exitCode = failures ? 1 : 0
})()
