import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync, rmSync, mkdtempSync, readdirSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// Optional tool: Playwright is not a project dependency (keeps installs small).
// One-time setup: pnpm add -D playwright && pnpm exec playwright install chromium   (ffmpeg on PATH for the GIF)
let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('scripts/capture.mjs needs Playwright: pnpm add -D playwright && pnpm exec playwright install chromium')
  process.exit(1)
}

const BASE_URL = 'https://airwise-beta.vercel.app'
const USER_AGENT = 'AirWise-capture/1.0'
const OUT_DIR = resolve('docs/media')
const MAX_PNG_BYTES = 500 * 1024
const MAX_GIF_BYTES = 5 * 1024 * 1024

mkdirSync(OUT_DIR, { recursive: true })

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function waitForPageReady(page, extraMs = 800) {
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {})
  await page
    .waitForFunction(
      () => {
        const main = document.querySelector('main') || document.body
        const text = (main.innerText || '').toLowerCase()
        const busy =
          text.includes('thinking') ||
          text.includes('planning your day') ||
          text.includes('loading...') ||
          text.includes('generating') ||
          text.includes('building your') ||
          Boolean(main.querySelector('[role="status"], [aria-busy="true"], .animate-pulse, .animate-spin'))
        if (busy) return false
        if (location.pathname.endsWith('/overview') && text.includes("today's ai summary")) {
          return text.includes('gemini') || text.includes('fallback')
        }
        return true
      },
      { timeout: 40_000 }
    )
    .catch(() => {})
  await page.waitForTimeout(extraMs)
}

async function saveScreenshot(page, filename, ffmpegAvailable) {
  const target = join(OUT_DIR, filename)
  await page.screenshot({ path: target, fullPage: false, type: 'png' })

  let size = statSync(target).size
  if (size > MAX_PNG_BYTES && ffmpegAvailable) {
    const tmpCompressed = `${target}.opt.png`
    try {
      execFileSync(
        'ffmpeg',
        ['-y', '-i', target, '-compression_level', '9', '-pred', 'mixed', tmpCompressed],
        { stdio: 'ignore' }
      )
      const optSize = statSync(tmpCompressed).size
      if (optSize < size) {
        renameSync(tmpCompressed, target)
        size = optSize
      } else {
        rmSync(tmpCompressed, { force: true })
      }
    } catch {
      rmSync(tmpCompressed, { force: true })
    }
  }

  if (size > MAX_PNG_BYTES && ffmpegAvailable) {
    const webpPath = target.replace(/\.png$/i, '.webp')
    try {
      execFileSync('ffmpeg', ['-y', '-i', target, '-quality', '82', webpPath], { stdio: 'ignore' })
      rmSync(target, { force: true })
      console.warn(`Converted ${filename} to ${webpPath} because PNG exceeded 500 KB`)
    } catch {
      console.warn(`Warning: ${filename} is ${(size / 1024).toFixed(1)} KB (> 500 KB)`)
    }
  }
}

async function searchCityInMain(page, cityQuery, { pickFirst = true } = {}) {
  const main = page.locator('main')
  const input = main.getByLabel('City').first()
  await input.waitFor({ state: 'visible', timeout: 15_000 })
  await input.fill(cityQuery)

  const searchBtn = main.locator('form button[type="submit"]').first()
  await searchBtn.click()

  if (pickFirst) {
    const resultBtn = main.locator('ul button').first()
    try {
      await resultBtn.waitFor({ state: 'visible', timeout: 6_000 })
      await resultBtn.click()
    } catch {
      // Single match auto-selects in CitySearch.jsx
    }
    await waitForPageReady(page)
  }
}

async function configureProfile(page) {
  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })
  await waitForPageReady(page)

  // Step 2: Search Delhi (click Search button, do not press Enter) & pick first result
  await searchCityInMain(page, 'Delhi', { pickFirst: true })

  // Step 3: Set household: 1 kid, asthma, car, 10 km, 09:00, LPG, morning walk 07:00
  const main = page.locator('main')
  await main.locator('#kids').fill('1')
  const asthma = main.locator('#asthma')
  if (!(await asthma.isChecked())) await asthma.check()

  await main.locator('#mode').selectOption('car')
  await main.locator('#distanceKm').fill('10')
  await main.locator('#commuteTime').fill('09:00')
  await main.locator('#fuel').selectOption('lpg')

  const walk = main.locator('#walk')
  if (!(await walk.isChecked())) await walk.check()
  await main.locator('#walkTime').fill('07:00')

  await main.locator('form button[type="submit"]').last().click()
  await page.waitForURL(/\/overview/, { timeout: 15_000 }).catch(() => {})
  await waitForPageReady(page)
}

async function navViaSideMenu(page, routePath) {
  const nav = page.locator('nav[aria-label="Main"]').first()
  await nav.locator(`a[href="${routePath}"]`).first().click()
  await page.waitForURL(new RegExp(`${routePath}$`), { timeout: 15_000 }).catch(() => {})
  await waitForPageReady(page)
}

async function askChat(page, question) {
  const log = page.locator('[role="log"]').first()
  const beforeCount = await log.locator('> div').count().catch(() => 0)

  await page.locator('#chat-input').fill(question)
  await page.locator('main form button[type="submit"]').first().click()

  await page
    .waitForFunction(
      ({ prev }) => {
        const logEl = document.querySelector('[role="log"]')
        const thinking = document.querySelector('[role="status"]')
        if (!logEl || thinking) return false
        return logEl.children.length >= prev + 2
      },
      { prev: beforeCount },
      { timeout: 35_000 }
    )
    .catch(() => {})

  await waitForPageReady(page)
}

function convertToGif(videoPath, outGif) {
  const palette = join(tmpdir(), `airwise-palette-${Date.now()}.png`)
  const encode = (width, fps) => {
    execFileSync(
      'ffmpeg',
      ['-y', '-i', videoPath, '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`, palette],
      { stdio: 'ignore' }
    )
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        videoPath,
        '-i',
        palette,
        '-lavfi',
        `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
        outGif,
      ],
      { stdio: 'ignore' }
    )
  }

  try {
    encode(800, 10)
    if (statSync(outGif).size > MAX_GIF_BYTES) {
      encode(720, 8)
    }
  } finally {
    rmSync(palette, { force: true })
  }
}

async function main() {
  const ffmpegAvailable = hasFfmpeg()
  if (!ffmpegAvailable) {
    console.warn('ffmpeg is not installed — skipping GIF generation (screenshots will still be captured).')
  }

  const browser = await chromium.launch({ headless: true })
  let savedStorage = null

  try {
    // 1. Desktop context for screenshots
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'en-IN',
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: process.env.CAPTURE_IGNORE_HTTPS === "1",
    })
    const page = await context.newPage()

    await configureProfile(page)
    savedStorage = await context.storageState()

    // 4. Core routes via side menu
    const routes = [
      ['/overview', 'overview.png'],
      ['/forecast', 'forecast.png'],
      ['/routine', 'routine.png'],
      ['/indoor', 'indoor.png'],
      ['/swaps', 'swaps.png'],
      ['/exposure', 'exposure.png'],
    ]

    for (const [routePath, filename] of routes) {
      await navViaSideMenu(page, routePath)
      if (routePath === '/forecast') await page.waitForTimeout(1000)
      await saveScreenshot(page, filename, ffmpegAvailable)
    }

    // 5. Chat (question 1 of max 4)
    await navViaSideMenu(page, '/chat')
    await askChat(page, 'Can my kid play cricket outside at 7am?')
    await saveScreenshot(page, 'chat.png', ffmpegAvailable)

    // 6. Inspector (wait for Gemini badge; if fallback, wait 20s and reload once)
    await navViaSideMenu(page, '/inspector')
    const badgeText = (await page.locator('main').innerText()).toLowerCase()
    if (badgeText.includes('fallback') && !badgeText.includes('gemini')) {
      await page.waitForTimeout(20_000)
      await page.reload({ waitUntil: 'networkidle' })
      await waitForPageReady(page)
    }
    await saveScreenshot(page, 'inspector.png', ffmpegAvailable)

    // 7. Error state on /profile, then reset to Delhi
    await navViaSideMenu(page, '/profile')
    await searchCityInMain(page, 'asdfgh', { pickFirst: false })
    await page.getByText(/city not found/i).first().waitFor({ state: 'visible', timeout: 10_000 })
    await saveScreenshot(page, 'error-city.png', ffmpegAvailable)
    await searchCityInMain(page, 'Delhi', { pickFirst: true })

    // 8. Mobile viewport with menu drawer open on /overview
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/overview`, { waitUntil: 'networkidle' })
    await waitForPageReady(page)
    await page.locator('button[aria-label="Open menu"]').click()
    await page.locator('[role="dialog"][aria-label="Menu"]').waitFor({ state: 'visible', timeout: 5_000 })
    await page.waitForTimeout(300)
    await saveScreenshot(page, 'mobile.png', ffmpegAvailable)

    await context.close()

    // 9. Second context for short demo GIF (< 25 s)
    if (ffmpegAvailable) {
      const videoTmpDir = mkdtempSync(join(tmpdir(), 'airwise-video-'))
      const gifContext = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        locale: 'en-IN',
        userAgent: USER_AGENT,
      ignoreHTTPSErrors: process.env.CAPTURE_IGNORE_HTTPS === "1",
        storageState: savedStorage,
        recordVideo: { dir: videoTmpDir, size: { width: 1280, height: 800 } },
      })
      const gifPage = await gifContext.newPage()

      await gifPage.goto(`${BASE_URL}/overview`, { waitUntil: 'networkidle' })
      await waitForPageReady(gifPage)
      await gifPage.waitForTimeout(1500)

      await navViaSideMenu(gifPage, '/routine')
      await gifPage.waitForTimeout(1500)

      await navViaSideMenu(gifPage, '/swaps')
      await gifPage.waitForTimeout(1000)
      const firstToggle = gifPage.locator('main button[aria-pressed]').first()
      if (await firstToggle.isVisible().catch(() => false)) {
        await firstToggle.click()
        await gifPage.waitForTimeout(700)
        await firstToggle.click()
        await gifPage.waitForTimeout(800)
      }

      // Chat question 2 of max 4
      await navViaSideMenu(gifPage, '/chat')
      await askChat(gifPage, 'Best hour for a walk today?')
      await gifPage.waitForTimeout(1500)

      await navViaSideMenu(gifPage, '/inspector')
      await gifPage.waitForTimeout(1500)

      const video = gifPage.video()
      await gifContext.close()
      const videoPath = await video?.path()

      if (videoPath) {
        convertToGif(videoPath, join(OUT_DIR, 'demo.gif'))
      }
      rmSync(videoTmpDir, { recursive: true, force: true })
    }
  } finally {
    await browser.close()
  }

  console.info('\nCreated media files in docs/media/:')
  for (const name of readdirSync(OUT_DIR).sort()) {
    const bytes = statSync(join(OUT_DIR, name)).size
    console.info(`- docs/media/${name} (${(bytes / 1024).toFixed(1)} KB)`)
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
