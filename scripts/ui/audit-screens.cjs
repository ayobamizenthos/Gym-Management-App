require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

process.env.APP_URL = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const BASE = process.env.APP_URL
const SHOTS = './.ui-shots'

const VIEWPORTS = [
  { name: 'small', width: 320, height: 700, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: false },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]

const ACCOUNTS = {
  admin: { email: process.env.TEST_ADMIN, password: process.env.TEST_PASSWORD },
  desk: { email: process.env.TEST_DESK, password: process.env.TEST_PASSWORD },
  member: { email: process.env.TEST_MEMBER, password: process.env.TEST_PASSWORD },
}

const ROUTES = {
  admin: ['/admin', '/admin/members', '/admin/plans', '/admin/branches', '/admin/staff', '/admin/settings', '/admin/alerts', '/admin/more'],
  desk: ['/desk', '/desk/members', '/desk/members/new', '/desk/payments', '/desk/alerts', '/desk/more'],
  member: ['/m', '/m/renew', '/m/referrals', '/m/account', '/m/history', '/m/alerts'],
}

const PUBLIC = ['/login', '/join', '/forgot-password', '/reset-password']

const problems = []
const note = (where, what) => { problems.push(where + ' :: ' + what); console.log('  ! ' + what) }

async function signIn(page, who) {
  const { email, password } = ACCOUNTS[who]
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  // the submit button stays disabled until React takes over, so waiting for it
  // to enable is the honest signal that the page is interactive
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 45000 })
  await page.fill('form input:not([type="password"])', email)
  await page.fill('input[type="password"]', password)
  await Promise.all([
    page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ])
}

async function auditLayout(page, label) {
  const report = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth
    const overflowing = []
    const smallTargets = []
    const lowContrast = []

    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > docWidth + 1 || r.left < -1) {
        let p = el.parentElement
        let contained = getComputedStyle(el).position === 'fixed'
        while (p && !contained) {
          const ps = getComputedStyle(p)
          if (['auto', 'scroll', 'hidden'].includes(ps.overflowX)) contained = true
          p = p.parentElement
        }
        if (!contained) overflowing.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 50))
      }
    }

    for (const el of document.querySelectorAll('button, a[href], select, input:not([type="hidden"])')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.height < 34 || r.width < 28) {
        smallTargets.push(el.tagName.toLowerCase() + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height))
      }
    }

    // any near-invisible text - the white-on-white class of bug
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const backdrop = (el) => {
      let node = el
      while (node && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor
        if (bg && !bg.includes('rgba(0, 0, 0, 0)') && !bg.startsWith('rgba(0,0,0,0')) return bg
        node = node.parentElement
      }
      return 'rgb(10, 10, 11)'
    }
    for (const el of document.querySelectorAll('p, span, h1, h2, h3, a, button, dt, dd, li, legend, label')) {
      if (!el.textContent.trim()) continue
      if (el.children.length > 0) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || Number(style.opacity) < 0.2) continue
      try {
        const fg = luminance(style.color)
        const bg = luminance(backdrop(el))
        const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
        const size = parseFloat(style.fontSize)
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
        if (ratio < (large ? 3 : 4.5)) {
          lowContrast.push('"' + el.textContent.trim().slice(0, 24) + '" ' + ratio.toFixed(2) + ':1')
        }
      } catch {}
    }

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: docWidth,
      overflowing: [...new Set(overflowing)].slice(0, 5),
      smallTargets: [...new Set(smallTargets)].slice(0, 5),
      lowContrast: [...new Set(lowContrast)].slice(0, 5),
    }
  })

  if (report.scrollWidth > report.clientWidth + 1) note(label, 'horizontal scroll ' + report.scrollWidth + '>' + report.clientWidth)
  report.overflowing.forEach(o => note(label, 'overflows: ' + o))
  report.smallTargets.forEach(t => note(label, 'tap target: ' + t))
  report.lowContrast.forEach(c => note(label, 'contrast: ' + c))
}

async function exerciseInteractions(page, who, label) {
  const url = page.url()

  // every accordion must open and close, and report its state to assistive tech
  const headers = await page.locator('button[aria-expanded][aria-controls]').elementHandles()
  for (const header of headers) {
    try {
      const before = await header.getAttribute('aria-expanded')
      await header.click()
      await page.waitForTimeout(160)
      const after = await header.getAttribute('aria-expanded')
      if (before === after) note(label, 'accordion did not toggle: ' + (await header.innerText()).slice(0, 24))
      const panelId = await header.getAttribute('aria-controls')
      if (panelId && after === 'true') {
        const visible = await page.evaluate(id => {
          const el = document.getElementById(id)
          return el ? !el.hidden && el.getBoundingClientRect().height > 0 : null
        }, panelId)
        if (visible === false) note(label, 'accordion open but panel hidden')
      }
      await header.click()
      await page.waitForTimeout(120)
    } catch {
      // a control that navigated away is not an accordion; carry on
      break
    }
  }

  if (page.url() !== url) {
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(700)
  }

  // keyboard reachability, measured from the top of the document - tabbing off
  // the last element correctly leaves the page, so start fresh
  try {
    await page.evaluate(() => document.body.focus())
    const reached = []
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Tab')
      reached.push(await page.evaluate(() => document.activeElement?.tagName ?? 'none'))
    }
    if (reached.every(t => t === 'BODY' || t === 'none')) note(label, 'nothing receives keyboard focus')
  } catch {
    // a navigation mid-measurement is not a finding
  }
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()

  for (const vp of VIEWPORTS) {
    const ctxOpts = {
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: vp.mobile ? 3 : 1,
    }

    // public pages need no session
    const pub = await browser.newContext(ctxOpts)
    const pubPage = await pub.newPage()
    for (const route of PUBLIC) {
      const label = vp.name + ' ' + route
      console.log('· ' + label)
      await pubPage.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {})
      await pubPage.waitForTimeout(700)
      await auditLayout(pubPage, label)
      await pubPage.screenshot({ path: path.join(SHOTS, vp.name + '_' + route.slice(1) + '.png'), fullPage: true }).catch(() => {})
    }
    await pub.close()

    for (const who of Object.keys(ROUTES)) {
      const context = await browser.newContext(ctxOpts)
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
      page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message))

      try {
        await signIn(page, who)
      } catch (e) {
        note(vp.name + '/' + who, 'sign-in failed: ' + e.message)
        await context.close()
        continue
      }

      for (const route of ROUTES[who]) {
        const label = vp.name + ' ' + route
        console.log('· ' + label)
        await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {})
        await page.waitForTimeout(900)
        await auditLayout(page, label)
        await exerciseInteractions(page, who, label)
        await page.screenshot({ path: path.join(SHOTS, vp.name + '_' + route.replace(/\//g, '-').replace(/^-/, '') + '.png'), fullPage: true }).catch(() => {})
      }

      for (const err of consoleErrors) {
        if (/favicon|manifest|React DevTools|paystack|js\.paystack/i.test(err)) continue
        note(vp.name + '/' + who, 'console: ' + err.slice(0, 150))
      }
      await context.close()
    }
  }

  await browser.close()
  console.log('\n=========== ' + problems.length + ' findings ===========')
  fs.writeFileSync(path.join(SHOTS, 'findings.txt'), problems.join('\n'))
  const unique = [...new Set(problems.map(p => p.split(' :: ')[1]))]
  unique.forEach(u => console.log('  ' + u))
})()
