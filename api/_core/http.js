// @ts-check
// Transport helpers shared by the Vercel adapter (vercel.js) and the local server (../../server.js),
// so body limits, rate limits and error shapes are identical in both.

export const MAX_BODY_BYTES = 64 * 1024

/** Requests per IP per minute. Each advise/chat call can cost a Gemini request on the free tier. */
export const RATE_LIMITS = /** @type {const} */ ({ advise: 10, chat: 20 })
const WINDOW_MS = 60_000
const MAX_TRACKED = 5000

/** @type {Map<string, { start: number, count: number }>} */
const windows = new Map()

/**
 * Fixed-window, per-instance limiter. Good enough for a free-tier demo (each serverless instance keeps its own
 * counters); swap for Upstash/Redis if the app ever needs a global limit.
 * @param {keyof typeof RATE_LIMITS} scope
 * @param {string} ip
 * @param {number} [now]
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
export function checkRateLimit(scope, ip, now = Date.now()) {
  const key = `${scope}:${ip}`
  const w = windows.get(key)
  if (!w || now - w.start >= WINDOW_MS) {
    if (windows.size >= MAX_TRACKED) windows.delete(/** @type {string} */ (windows.keys().next().value))
    windows.set(key, { start: now, count: 1 })
    return { ok: true }
  }
  if (w.count >= RATE_LIMITS[scope]) return { ok: false, retryAfterSec: Math.ceil((w.start + WINDOW_MS - now) / 1000) }
  w.count += 1
  return { ok: true }
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
  const ip = clientIp(req.headers, req.ip)
  const rl = checkRateLimit(scope, ip)
  if (!rl.ok) {
    log(scope, 'rate_limited')
    return { status: 429, body: { ok: false, error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec }, headers: { 'Retry-After': String(rl.retryAfterSec) } }
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
