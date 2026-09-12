require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const BASE = process.env.APP_URL || 'http://127.0.0.1:4318'

const results = []
const check = (ok, what) => { results.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }

async function signIn(page, identifier, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])')
  await page.fill('form input:not([type="password"])', identifier)
  await page.fill('input[type="password"]', password)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 40000 }), page.click('button[type="submit"]')])
}

;(async () => {
  const browser = await chromium.launch()

  for (const vp of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await signIn(page, process.env.TEST_DESK, process.env.TEST_PASSWORD)
    await page.goto(BASE + '/desk/members', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const firstMember = page.locator('ul[role="list"] a').first()
    check(await firstMember.count() > 0, vp.name + ': the desk sees a member list')
    await firstMember.click()
    await page.waitForTimeout(1400)

    check(page.url().includes('/desk/members/'), vp.name + ': a member record opens')

    // the read-only summary must carry the identifiers the desk quotes
    await page.click('button:has-text("Details")')
    await page.waitForTimeout(400)
    const summary = await page.locator('dl').first().innerText()
    check(/Member code/i.test(summary), vp.name + ': member code is on the record')
    check(/Username/i.test(summary), vp.name + ': username is on the record')

    // correct a detail and confirm it sticks
    await page.click('button:has-text("Correct details")')
    await page.waitForTimeout(400)
    const stamp = '0803' + String(Date.now()).slice(-7)
    const phone = page.locator('label:has-text("Phone") input').last()
    await phone.fill(stamp)
    await page.click('button:has-text("Save details")')
    await page.waitForTimeout(2200)

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1400)
    const afterReload = await page.locator('body').innerText()
    check(afterReload.includes(stamp), vp.name + ': a corrected phone number persists')

    // sign-in help has to be reachable and explain the identity
    await page.click('button:has-text("Sign-in help")')
    await page.waitForTimeout(400)
    const help = await page.locator('section:has(button:has-text("Sign-in help"))').innerText()
    check(/They sign in with/i.test(help), vp.name + ': sign-in help names their identifier')

    check(errors.length === 0, vp.name + ': no runtime errors' + (errors.length ? ' -> ' + errors[0].slice(0, 120) : ''))
    await ctx.close()
  }

  // a member must not be offered a name field any more
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await signIn(page, process.env.TEST_MEMBER, process.env.TEST_PASSWORD)
  await page.goto(BASE + '/m/account', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const labels = await page.locator('label').allInnerTexts()
  check(!labels.some(l => /full name/i.test(l)), 'member: the name is no longer an editable field')
  const body = await page.locator('body').innerText()
  check(/Username/i.test(body), 'member: their username is shown')
  check(/Email/i.test(body), 'member: their email is shown')
  check(!/Member code/i.test(body), 'member: the member code is gone from their account')
  check(!/invite name also signs you in/i.test(body), 'member: the explainer line is gone')

  // and their own contact details must still save
  const stamp = '0805' + String(Date.now()).slice(-7)
  await page.locator('label:has-text("Phone") input').fill(stamp)
  await page.click('button:has-text("Save changes")')
  await page.waitForTimeout(2200)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  // the value lives in an input, which innerText does not expose
  check((await page.locator('label:has-text("Phone") input').inputValue()) === stamp, 'member: their own phone still saves')
  await ctx.close()

  await browser.close()
  results.forEach(r => console.log(r))
})()
