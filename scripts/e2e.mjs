// Real-browser smoke test: production build + production security headers (vite preview), Chromium via Playwright.
// Checks the main user flow, an error case, axe-core WCAG rules including colour contrast on all 9 screens,
// the mobile drawer, and that the CSP blocks nothing. External APIs are stubbed so the run is deterministic:
// Open-Meteo is answered from fixtures and /api/* runs the real server handlers in-process with a stubbed Gemini.
// One-time setup: pnpm exec playwright install chromium    Run: pnpm e2e
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { preview } from 'vite'

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('scripts/e2e.mjs needs Playwright: pnpm install && pnpm exec playwright install chromium')
  process.exit(1)
}

process.env.AIRWISE_SILENT_LOGS = '1'
process.env.GEMINI_API_KEY = 'e2e-stub'
const { handleAdvise, handleChat } = await import('../api/_core/handlers.js')
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

// ---- fixtures -------------------------------------------------------------------------------------------------
const DELHI = { name: 'New Delhi', admin1: 'Delhi', country: 'India', country_code: 'IN', latitude: 28.63, longitude: 77.22 }
const hours = Array.from({ length: 48 }, (_, i) => `2026-11-${23 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`)
const pm = hours.map((_, i) => Math.round(90 + 70 * Math.cos(((i % 24) - 7) / 24 * 2 * Math.PI)))
const AIR = {
  latitude: DELHI.latitude, longitude: DELHI.longitude, timezone: 'Asia/Kolkata', utc_offset_seconds: 19800,
  current: { time: hours[9], pm2_5: pm[9], pm10: pm[9] * 1.6, nitrogen_dioxide: 41, ozone: 22, carbon_monoxide: 900, sulphur_dioxide: 9 },
  hourly: { time: hours, pm2_5: pm, pm10: pm.map((v) => v * 1.6), nitrogen_dioxide: hours.map(() => 40) },
}
const ADVICE = {
  summary: 'Very poor air this morning; the cleanest window is mid-afternoon.',
  risk_level: 'high',
  routine: [{ time: '15:00', activity: 'Short walk', reason: 'PM2.5 is lowest around 15:00' }],
  indoor_hacks: [{ tip: 'Keep windows shut until 14:00', why: 'Morning PM2.5 is highest', effort: 'low' }],
  swaps: [{ id: 'carToMetro', from: 'Car', to: 'Metro', impact_explained: 'Cuts commute CO₂ and in-cabin exposure' }],
}
const geminiReply = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (!String(url).includes('generativelanguage.googleapis.com')) return realFetch(url, init)
  const wantsJson = JSON.parse(init.body).generationConfig?.responseMimeType === 'application/json'
  return wantsJson
    ? geminiReply(JSON.stringify(ADVICE))
    : geminiReply('<b>Yes</b>, after 15:00 is best. Keep it short and skip the main road.')
}

// ---- harness ---------------------------------------------------------------------------------------------------
const failures = []
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what) }

const server = await preview({ preview: { port: 4173, strictPort: false }, logLevel: 'error' })
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()

let lastPage = null
async function newPage(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  lastPage = page
  const cspViolations = []
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text()) })
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`))
  // fonts load for real
  await page.route(/geocoding-api\.open-meteo\.com/, (r) => {
    const name = new URL(r.request().url()).searchParams.get('name') || ''
    return r.fulfill({ json: /delhi/i.test(name) ? { results: [DELHI] } : {} })
  })
  await page.route(/air-quality-api\.open-meteo\.com/, (r) => r.fulfill({ json: AIR }))
  await page.route(/\/api\/(advise|chat)$/, async (r) => {
    const handler = r.request().url().endsWith('/advise') ? handleAdvise : handleChat
    const out = await handler(JSON.parse(r.request().postData() || '{}'))
    return r.fulfill({ status: out.status, json: out.body })
  })
  return { page, cspViolations }
}

// preload: false stops axe from XHR-fetching the font CSS, which connect-src rightly blocks.
async function axe(page, label) {
  await page.mouse.move(0, 0) // no hover styles
  await page.waitForTimeout(400) // let colour transitions finish so contrast is measured on final colours
  await page.evaluate(axeSource)
  const violations = await page.evaluate(async () =>
    (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'], preload: false })).violations.map(
      (v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`,
    ),
  )
  check(violations.length === 0, `axe WCAG 2.1 AA incl. contrast: ${label}${violations.length ? `\n      ${violations.join('\n      ')}` : ''}`)
}

try {
  // Desktop: onboarding flow, error case, every screen.
  const { page, cspViolations } = await newPage({ width: 1366, height: 900 })
  await page.goto(`${base}/`)
  await page.waitForURL(/\/profile$/)
  check(true, 'first visit redirects to /profile')
  await axe(page, '/profile (empty)')

  const city = page.locator('main').getByLabel('City').first()
  await city.fill('Atlantis')
  await page.locator('main form button[type="submit"]').first().click()
  const alert = page.locator('main [role="alert"]').first()
  await alert.waitFor()
  check(/City not found/.test(await alert.innerText()), 'unknown city shows an accessible error')

  await city.fill('Delhi')
  await page.locator('main form button[type="submit"]').first().click()
  await page.getByText('Now in New Delhi').first().waitFor()
  check(true, 'known city loads live AQI')
  await page.locator('#kids').fill('1')
  await page.locator('#asthma').check()
  await page.locator('#mode').selectOption('car')
  await page.locator('#distanceKm').fill('10')
  await page.locator('main form button[type="submit"]').last().click()
  await page.waitForURL(/\/overview$/)
  await page.getByText(ADVICE.summary).waitFor()
  check(true, 'saving the profile opens Overview with the AI summary')

  for (const path of ['/overview', '/forecast', '/routine', '/indoor', '/swaps', '/exposure', '/inspector']) {
    await page.locator('nav[aria-label="Main"]').first().locator(`a[href="${path}"]`).click()
    await page.waitForURL(new RegExp(`${path}$`))
    await page.locator('main h2, main table, main svg').first().waitFor()
    await axe(page, path)
  }

  await page.locator('nav[aria-label="Main"]').first().locator('a[href="/chat"]').click()
  await page.locator('#chat-input').fill('Can my kid play outside at 5 pm?')
  await page.locator('main form button[type="submit"]').first().click()
  const reply = page.locator('[role="log"] >> text=after 15:00 is best')
  await reply.waitFor()
  check(!(await page.locator('[role="log"]').innerHTML()).includes('<b>Yes'), 'chat reply arrives with model markup stripped')
  await axe(page, '/chat')

  await page.reload()
  await page.getByText('Now in New Delhi').first().waitFor()
  check(true, 'city and profile survive a reload')
  check(cspViolations.length === 0, `no CSP violations (${cspViolations.length})${cspViolations.length ? `: ${cspViolations[0]}` : ''}`)

  // Mobile: drawer focus handling.
  const m = await newPage({ width: 390, height: 844 })
  await m.page.goto(`${base}/forecast`)
  await m.page.getByRole('button', { name: 'Open menu' }).click()
  const close = m.page.getByRole('button', { name: 'Close menu' })
  check(await close.evaluate((el) => el === document.activeElement), 'mobile drawer focuses Close')
  await m.page.keyboard.press('Escape')
  check(await m.page.getByRole('button', { name: 'Open menu' }).evaluate((el) => el === document.activeElement), 'Escape closes drawer and returns focus')
  await axe(m.page, 'mobile /forecast')
} catch (e) {
  if (process.env.E2E_DEBUG && lastPage) console.error(lastPage.url(), '\n', (await lastPage.locator('body').innerText()).slice(0, 1500))
  failures.push(`crashed: ${e instanceof Error ? e.message : String(e)}`)
} finally {
  await browser.close()
  await new Promise((r) => server.httpServer.close(r))
}

if (failures.length) {
  console.error(`\n${failures.length} E2E check(s) failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('\nE2E: all checks passed')
