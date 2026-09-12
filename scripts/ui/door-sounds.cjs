require('dotenv').config({ path: '.env.local' })
const { chromium } = require('playwright')
const BASE = process.env.APP_URL || 'https://zenthosgym.netlify.app'
const out = []
const check = (ok, what) => { out.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) process.exitCode = 1 }
;(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream'] })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  // record what the page asks the speech engine to say, and what the audio graph builds
  await page.addInitScript(() => {
    window.__spoken = []
    window.__nodes = { osc: 0, gain: 0, buffer: 0, compressor: 0 }
    const realSpeak = window.speechSynthesis && window.speechSynthesis.speak
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = function (u) {
        window.__spoken.push({ text: u.text, rate: u.rate, pitch: u.pitch })
        try { return realSpeak.call(window.speechSynthesis, u) } catch { /* headless has no engine */ }
      }
    }
    const AC = window.AudioContext
    if (AC) {
      const wrap = (name, key) => {
        const real = AC.prototype[name]
        AC.prototype[name] = function (...args) { window.__nodes[key] += 1; return real.apply(this, args) }
      }
      wrap('createOscillator', 'osc'); wrap('createGain', 'gain')
      wrap('createBufferSource', 'buffer'); wrap('createDynamicsCompressor', 'compressor')
    }
  })

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[type="submit"]:not([disabled])')
  await page.fill('form input:not([type="password"])', process.env.TEST_ADMIN)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login')), page.click('button[type="submit"]')])

  await page.goto(BASE + '/admin/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.click('button:has-text("Door sounds")')
  await page.waitForTimeout(400)

  const before = await page.evaluate(() => ({ ...window.__nodes }))
  await page.click('button:has-text("Access granted")')
  await page.waitForTimeout(1400)
  const after = await page.evaluate(() => ({ ...window.__nodes }))
  const spoken = await page.evaluate(() => window.__spoken)

  check(after.osc > before.osc, 'the granted chime builds oscillators (' + (after.osc - before.osc) + ')')
  check(after.buffer > before.buffer, 'it fires a noise transient so it cuts through')
  check(after.compressor >= 1, 'output runs through a limiter')
  check(spoken.some(s => /access granted/i.test(s.text)), 'it says "Access granted" (' + JSON.stringify(spoken.map(s => s.text)) + ')')
  // a woman's voice sits at natural pitch; above 1 is where it turns into a toy.
  // the silent primer that unlocks iOS speech is not an announcement.
  const said = spoken.filter(s => s.text.trim())
  check(said.length > 0 && said.every(s => s.pitch <= 1), 'no announcement is pitched into a chipmunk')
  check(spoken.some(s => !s.text.trim()), 'speech is primed with a silent utterance so iOS honours the chosen voice')

  await page.click('button:has-text("Membership expired")')
  await page.waitForTimeout(1800)
  const all = await page.evaluate(() => window.__spoken)
  check(all.some(s => /membership expired/i.test(s.text)), 'the refusal says "Membership expired"')

  await page.click('button:has-text("No active subscription")')
  await page.waitForTimeout(1200)
  const all2 = await page.evaluate(() => window.__spoken)
  check(all2.some(s => /no active subscription/i.test(s.text)) && !all2.some(s => /please subscribe/i.test(s.text)),
    'the no-subscription line stops at the fact')

  check(errs.length === 0, 'no runtime errors' + (errs.length ? ' -> ' + errs[0].slice(0, 90) : ''))
  await b.close()
  out.forEach(r => console.log(r))
})()
