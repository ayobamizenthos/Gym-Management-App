require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const BASE = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const OUT = './.ui-shots'
const out = []
const check = (ok, what) => { out.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }

;(async () => {
  require('fs').mkdirSync(OUT, { recursive: true })
  // two fake cameras, so the switch control has a reason to exist
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    permissions: ['camera'],
  })
  const page = await ctx.newPage()
  // the headless fake camera reports a single device, so the second one is
  // stubbed in to exercise the switch the way a real phone would
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
    navigator.mediaDevices.enumerateDevices = async () => {
      const found = await real()
      const cams = found.filter(d => d.kind === 'videoinput')
      if (cams.length > 1) return found
      return [...found, { kind: 'videoinput', deviceId: 'front', groupId: 'g2', label: 'Front Camera', toJSON: () => ({}) }]
    }
  })

  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])')
  await page.fill('form input:not([type="password"])', process.env.TEST_MEMBER)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login')), page.click('button[type="submit"]')])

  await page.goto(BASE + '/m/scan', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const brackets = await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span')].filter(s => /border-(l|r)-2/.test(s.className))
    return spans.map(s => getComputedStyle(s).borderTopColor || getComputedStyle(s).borderBottomColor)
  })
  check(brackets.length === 4, 'four corner brackets are drawn (' + brackets.length + ')')
  check(brackets.every(c => /rgba?\(\s*255,\s*255,\s*255/.test(c)), 'brackets are white, not green (' + brackets[0] + ')')

  const flip = page.locator('button[aria-label*="camera" i]')
  check(await flip.count() === 1, 'one camera switch control is present')
  const box = await flip.boundingBox()
  check(Boolean(box) && box.width >= 44 && box.height >= 44, 'it is a comfortable tap target')
  check(Boolean(box) && box.x + box.width > 300 && box.y > 400, 'it sits bottom right, clear of the brackets')
  check((await flip.innerText()).trim() === '', 'it is an icon with no text label')

  await page.screenshot({ path: OUT + '/scan-back.png' })

  const before = await flip.getAttribute('aria-label')
  await flip.click()
  await page.waitForTimeout(2500)
  const after = await flip.getAttribute('aria-label')
  check(before !== after, 'tapping it switches camera (' + before + ' -> ' + after + ')')
  const mirrored = await page.evaluate(() => document.querySelector('video').className.includes('-scale-x-100'))
  check(mirrored, 'the front camera view is mirrored, as people expect')
  await page.screenshot({ path: OUT + '/scan-front.png' })

  const bell = await page.locator('a[aria-label*="lert" i]').count()
  check(bell === 0, 'no notification bell over the scanner')

  check(errs.length === 0, 'no runtime errors' + (errs.length ? ' -> ' + errs[0].slice(0, 90) : ''))
  await browser.close()
  out.forEach(r => console.log(r))
})()
