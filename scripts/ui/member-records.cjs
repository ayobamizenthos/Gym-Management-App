require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const { contextFor, removeMember } = require('./session.cjs')
process.env.APP_URL = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const BASE = process.env.APP_URL

const results = []
const check = (ok, what) => { results.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }


;(async () => {
  const browser = await chromium.launch()

  for (const vp of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
    const { context: ctx, page } = await contextFor(browser, 'desk', process.env.TEST_DESK, { viewport: vp })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(BASE + '/desk/members', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    await page.waitForSelector('ul[role="list"] a', { timeout: 30000 })
    const firstMember = page.locator('ul[role="list"] a').first()
    check(await firstMember.count() > 0, vp.name + ': the desk sees a member list')
    await firstMember.click()
    await page.waitForURL('**/desk/members/*', { timeout: 30000 })
    await page.waitForTimeout(1500)

    check(page.url().includes('/desk/members/'), vp.name + ': a member record opens')

    // the read-only summary must carry the identifiers the desk quotes
    await page.click('button:has-text("Details")')
    await page.waitForTimeout(400)
    const summary = await page.locator('dl').first().innerText()
    check(!/Member code/i.test(summary), vp.name + ': the retired member code is not on the record')
    check(/Username/i.test(summary), vp.name + ': username is on the record')
    check(/Date of birth/i.test(summary), vp.name + ': date of birth is on the record')

    // correct a detail and confirm it sticks
    await page.click('button:has-text("Correct details")')
    await page.waitForTimeout(400)
    const stamp = '0803' + String(Date.now()).slice(-7)
    const phone = page.locator('label:has-text("Phone") input').last()
    await phone.fill(stamp)
    await page.click('button:has-text("Save details")')
    // wait for the save to be acknowledged rather than guessing at a duration,
    // or a slow connection reloads the page before the write has landed
    const saved = await page
      .waitForFunction(() => /Details updated/i.test(document.body.innerText), null, { timeout: 30000 })
      .then(() => true)
      .catch(() => false)
    check(saved, vp.name + ': the save is acknowledged')

    await page.reload({ waitUntil: 'domcontentloaded' })
    const persisted = await page
      .waitForFunction(expected => document.body.innerText.includes(expected), stamp, { timeout: 20000 })
      .then(() => true)
      .catch(() => false)
    check(persisted, vp.name + ': a corrected phone number persists')

    // sign-in help has to be reachable and explain the identity
    await page.click('button:has-text("Sign-in help")')
    await page.waitForTimeout(400)
    const help = await page.locator('section:has(button:has-text("Sign-in help"))').innerText()
    check(/They sign in with/i.test(help), vp.name + ': sign-in help names their identifier')

    check(errors.length === 0, vp.name + ': no runtime errors' + (errors.length ? ' -> ' + errors[0].slice(0, 120) : ''))
    await ctx.close()
  }

  // a member must not be offered a name field any more
  const { context: ctx, page } = await contextFor(browser, 'member', process.env.TEST_MEMBER)
  await page.goto(BASE + '/m/account', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.waitForSelector('label:has-text("Phone") input', { timeout: 30000 })
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
  const save = page.locator('button:has-text("Save changes")')
  await save.waitFor({ state: 'visible', timeout: 15000 })
  await save.click()
  // the write has to land before the reload, or the reload races it
  await page.waitForResponse(r => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH', { timeout: 30000 })
  await page.waitForTimeout(800)
  await page.reload({ waitUntil: 'domcontentloaded' })
  // the form fills in once the profile arrives, so wait for the value itself
  const landed = await page
    .waitForFunction(
      expected => {
        const labels = [...document.querySelectorAll('label')]
        const field = labels.find(l => /Phone/.test(l.textContent || ''))?.querySelector('input')
        return field ? field.value === expected : false
      },
      stamp,
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false)
  check(landed, 'member: their own phone still saves')
  await ctx.close()

  await browser.close()
  await removeMember()
  results.forEach(r => console.log(r))
})()
