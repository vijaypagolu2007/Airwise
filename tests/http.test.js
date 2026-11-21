import { describe, it, expect, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import { checkRateLimit, clientIp, readJsonBody, resetRateLimits, runPost, RATE_LIMITS, MAX_BODY_BYTES } from '../api/_core/http.js'

const ok = async (body) => ({ status: 200, body: { ok: true, echo: body } })
const req = (over = {}) => ({ method: 'POST', headers: { 'x-real-ip': '1.2.3.4' }, body: { a: 1 }, ...over })

describe('http helpers', () => {
  beforeEach(() => { resetRateLimits(); process.env.AIRWISE_SILENT_LOGS = '1' })

  it('rate-limits per scope and IP within a window, then resets', () => {
    const t = 1_000_000
    for (let i = 0; i < RATE_LIMITS.advise; i++) expect(checkRateLimit('advise', 'ip', t).ok).toBe(true)
    const blocked = checkRateLimit('advise', 'ip', t + 1000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSec).toBe(59)
    expect(checkRateLimit('advise', 'other-ip', t).ok).toBe(true)
    expect(checkRateLimit('chat', 'ip', t).ok).toBe(true)
    expect(checkRateLimit('advise', 'ip', t + 60_000).ok).toBe(true)
  })

  it('takes x-real-ip, else the right-most forwarded hop, else the socket', () => {
    expect(clientIp({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' })).toBe('9.9.9.9')
    expect(clientIp({ 'x-forwarded-for': 'spoofed, 2.2.2.2' })).toBe('2.2.2.2')
    expect(clientIp({}, '3.3.3.3')).toBe('3.3.3.3')
    expect(clientIp({})).toBe('local')
  })

  it('reads a JSON stream and rejects oversized or invalid bodies', async () => {
    expect(await readJsonBody(Readable.from([Buffer.from('{"x":1}')]))).toEqual({ ok: true, value: { x: 1 } })
    expect(await readJsonBody(Readable.from([Buffer.alloc(MAX_BODY_BYTES + 1, 32)]))).toEqual({ ok: false, error: 'BODY_TOO_LARGE' })
    expect(await readJsonBody(Readable.from([Buffer.from('{oops')]))).toEqual({ ok: false, error: 'INVALID_JSON' })
  })

  it('runPost: 405 for GET, 400 for bad JSON string, 200 pass-through', async () => {
    expect((await runPost(req({ method: 'GET' }), 'chat', ok)).status).toBe(405)
    expect((await runPost(req({ body: '{bad' }), 'chat', ok)).status).toBe(400)
    const r = await runPost(req({ body: Readable.from([Buffer.from('{"q":2}')]) }), 'chat', ok)
    expect(r.body.echo).toEqual({ q: 2 })
  })

  it('runPost: 429 with Retry-After once the limit is hit', async () => {
    for (let i = 0; i < RATE_LIMITS.chat; i++) await runPost(req(), 'chat', ok)
    const r = await runPost(req(), 'chat', ok)
    expect(r.status).toBe(429)
    expect(r.headers['Retry-After']).toMatch(/^\d+$/)
  })

  it('runPost: a throwing handler becomes a JSON 500, never a crash', async () => {
    const r = await runPost(req(), 'advise', async () => { throw new Error('boom') })
    expect(r).toEqual({ status: 500, body: { ok: false, error: 'INTERNAL' } })
  })
})
