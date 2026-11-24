// @ts-check
// Transport helpers shared by the Vercel adapter (vercel.js) and the local server (../../server.js),
// so body limits, rate limits and error shapes are identical in both.
import { kvPipeline } from './kv.js'
import { verifyTurnstile } from './turnstile.js'

export const MAX_BODY_BYTES = 64 * 1024

/** Requests per IP per minute. Each advise/chat call can cost a Gemini request on the free tier. */
export const RATE_LIMITS = /** @type {const} */ ({ advise: 10, chat: 20 })
const WINDOW_MS = 60_000
const MAX_TRACKED = 5000

/** @type {Map<string, { start: number, count: number }>} */
const windows = new Map()

/**
 * Fixed-window limiter, per instance.
 * @param {keyof typeof RATE_LIMITS} scope
 * @param {string} ip
 * @param {number} now
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
function memoryLimit(scope, ip, now) {
  const key = `${scope}:${ip}`
  const w = windows.get(key)
  if (!w || now - w.start >= WINDOW_MS) {
    if (windows.size >= MAX_TRACKED) {
      for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k)
      if (windows.size >= MAX_TRACKED) windows.delete(/** @type {string} */ (windows.keys().next().value))
    }
    windows.set(key, { start: now, count: 1 })
    return { ok: true }
  }
  if (w.count >= RATE_LIMITS[scope]) return { ok: false, retryAfterSec: Math.ceil((w.start + WINDOW_MS - now) / 1000) }
  w.count += 1
  return { ok: true }
}

/**
 * Fixed-window limiter. Global across instances when Upstash is configured (kv.js); otherwise, or if the store
 * fails, per instance.
 * @param {keyof typeof RATE_LIMITS} scope
 * @param {string} ip
 * @param {number} [now]
 * @returns {Promise<{ ok: true } | { ok: false, retryAfterSec: number }>}
 */
export async function checkRateLimit(scope, ip, now = Date.now()) {
  const slot = Math.floor(now / WINDOW_MS)
  const key = `rl:${scope}:${ip}:${slot}`
  const shared = await kvPipeline([['INCR', key], ['PEXPIRE', key, WINDOW_MS]])
  if (shared && typeof shared[0] === 'number') {
    if (shared[0] <= RATE_LIMITS[scope]) return { ok: true }
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(((slot + 1) * WINDOW_MS - now) / 1000)) }
  }
  return memoryLimit(scope, ip, now)
}

/** Test hook. */
export const resetRateLimits = () => windows.clear()

/**
 * Best-effort client IP for rate limiting only (never auth): x-real-ip set by Vercel's proxy, else the
 * right-most x-forwarded-for hop (left-most entries are client-controlled), else the socket address.
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {string | undefined} [socketAddress]
 */
export function clientIp(headers, socketAddress) {
  const one = (/** @type {string | string[] | undefined} */ v) => (Array.isArray(v) ? v[0] : v) ?? ''
  const real = one(headers['x-real-ip']).trim()
  const hops = one(headers['x-forwarded-for']).split(',').map((h) => h.trim()).filter(Boolean)
  return (real || hops[hops.length - 1] || socketAddress || 'local').slice(0, 64)
}

/**
 * Browsers send Origin on every POST, same-site included. Allow same-host requests and ALLOWED_ORIGINS
 * (comma-separated); block other sites so they can't spend the Gemini quota through a visitor's browser.
 * In production a POST with no Origin (curl, scripts) is refused too; locally it is allowed for testing.
 * @param {Record<string, string | string[] | undefined>} headers
 */
export function originAllowed(headers) {
  const one = (/** @type {string | string[] | undefined} */ v) => (Array.isArray(v) ? v[0] : v) ?? ''
  const prod = process.env.NODE_ENV === 'production'
  const origin = one(headers.origin).trim()
  if (!origin) return !prod
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
  if (allowed.includes(origin)) return true
  if (one(headers['sec-fetch-site']) === 'cross-site') return false
  let host, hostname
  try { ({ host, hostname } = new URL(origin)) } catch { return false }
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1'
  if (isLoopback && !prod) return true // local dev via the Vite proxy
  const own = one(headers['x-forwarded-host']) || one(headers.host)
  return Boolean(own && host === own.trim())
}

/**
 * Read and parse a JSON request body from a Node stream, aborting once it passes MAX_BODY_BYTES.
 * @param {AsyncIterable<Buffer>} stream
 * @returns {Promise<{ ok: true, value: unknown } | { ok: false, error: 'BODY_TOO_LARGE' | 'INVALID_JSON' }>}
 */
export async function readJsonBody(stream) {
  let size = 0
  /** @type {Buffer[]} */
  const chunks = []
  for await (const chunk of stream) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) return { ok: false, error: 'BODY_TOO_LARGE' }
    chunks.push(chunk)
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }
  } catch {
    return { ok: false, error: 'INVALID_JSON' }
  }
}

/** Headers on every API response: no caching of personalised advice, no MIME sniffing. */
export const API_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

/**
 * One JSON log line per event; never logs the profile, question or key.
 * @param {string} route
 * @param {string} event
 * @param {Record<string, unknown>} [fields]
 */
export function log(route, event, fields = {}) {
  if (process.env.AIRWISE_SILENT_LOGS === '1') return
  console.info(JSON.stringify({ t: new Date().toISOString(), route, event, ...fields }))
}

/**
 * Run a framework-free POST handler with the shared limits. Returns the status, body and extra headers to send.
 * @param {{ method?: string, headers: Record<string, string | string[] | undefined>, body: AsyncIterable<Buffer> | unknown, ip?: string }} req
 * @param {keyof typeof RATE_LIMITS} scope
 * @param {(body: unknown) => Promise<{ status: number, body: unknown }>} handler
 * @returns {Promise<{ status: number, body: unknown, headers?: Record<string, string> }>}
 */
export async function runPost(req, scope, handler) {
  if (req.method !== 'POST') return { status: 405, body: { ok: false, error: 'METHOD_NOT_ALLOWED' }, headers: { Allow: 'POST' } }
  if (!originAllowed(req.headers)) {
    log(scope, 'origin_blocked')
    return { status: 403, body: { ok: false, error: 'FORBIDDEN_ORIGIN' } }
  }
  const ip = clientIp(req.headers, req.ip)
  const rl = await checkRateLimit(scope, ip)
  if (!rl.ok) {
    log(scope, 'rate_limited')
    return { status: 429, body: { ok: false, error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, headers: { 'Retry-After': String(rl.retryAfterSec) } }
  }
  // After the rate limit, so a flood never reaches Cloudflare; before the body, so bots cost us nothing more.
  const one = (/** @type {string | string[] | undefined} */ v) => (Array.isArray(v) ? v[0] : v) ?? ''
  const bot = await verifyTurnstile(one(req.headers['x-turnstile-token']), scope, ip)
  if (!bot.ok) {
    log(scope, 'bot_check_failed', { reason: bot.reason })
    return { status: 403, body: { ok: false, error: 'BOT_CHECK_FAILED' } }
  }
  let body = req.body
  if (body && typeof body === 'object' && Symbol.asyncIterator in body) {
    const parsed = await readJsonBody(/** @type {AsyncIterable<Buffer>} */ (body))
    if (!parsed.ok) return { status: parsed.error === 'BODY_TOO_LARGE' ? 413 : 400, body: { ok: false, error: parsed.error } }
    body = parsed.value
  } else if (typeof body === 'string') {
    if (body.length > MAX_BODY_BYTES) return { status: 413, body: { ok: false, error: 'BODY_TOO_LARGE' } }
    try { body = JSON.parse(body) } catch { return { status: 400, body: { ok: false, error: 'INVALID_JSON' } } }
  }
  try {
    return await handler(body)
  } catch (e) {
    log(scope, 'internal_error', { message: e instanceof Error ? e.message : String(e) })
    return { status: 500, body: { ok: false, error: 'INTERNAL' } }
  }
}
