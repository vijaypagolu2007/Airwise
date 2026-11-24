import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { verifyTurnstile, turnstileEnabled, SITEVERIFY_URL } from '../api/_core/turnstile.js'
import { resetRateLimits, runPost } from '../api/_core/http.js'

const reply = (json) => vi.fn(async () => ({ json: async () => json }))

describe('Turnstile (server)', () => {
  beforeEach(() => { delete process.env.TURNSTILE_SECRET_KEY; resetRateLimits(); process.env.AIRWISE_SILENT_LOGS = '1' })
  afterEach(() => { delete process.env.TURNSTILE_SECRET_KEY; vi.unstubAllGlobals() })

  it('is off without a secret: every request passes and Cloudflare is never called', async () => {
    const f = reply({ success: false })
    expect(turnstileEnabled()).toBe(false)
    expect(await verifyTurnstile('', 'chat', '1.2.3.4', f)).toEqual({ ok: true })
    expect(f).not.toHaveBeenCalled()
  })

  it('with a secret: refuses a missing or oversized token without calling Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 's'
    const f = reply({ success: true })
    expect(await verifyTurnstile('', 'chat', undefined, f)).toEqual({ ok: false, reason: 'missing' })
    expect(await verifyTurnstile('x'.repeat(3000), 'chat', undefined, f)).toEqual({ ok: false, reason: 'missing' })
    expect(f).not.toHaveBeenCalled()
  })

  it('posts secret, token and IP to siteverify and accepts a matching success', async () => {
    process.env.TURNSTILE_SECRET_KEY = 's'
    const f = reply({ success: true, action: 'advise' })
    expect(await verifyTurnstile('tok', 'advise', '9.9.9.9', f)).toEqual({ ok: true })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe(SITEVERIFY_URL)
    expect(Object.fromEntries(init.body)).toEqual({ secret: 's', response: 'tok', remoteip: '9.9.9.9' })
  })

  it('fails closed on rejection, wrong action, or Cloudflare being unreachable', async () => {
    process.env.TURNSTILE_SECRET_KEY = 's'
    expect(await verifyTurnstile('t', 'chat', 'local', reply({ success: false, 'error-codes': ['timeout-or-duplicate'] })))
      .toEqual({ ok: false, reason: 'timeout-or-duplicate' })
    expect(await verifyTurnstile('t', 'chat', 'local', reply({ success: false }))).toEqual({ ok: false, reason: 'rejected' })
    expect(await verifyTurnstile('t', 'chat', 'local', reply({ success: true, action: 'advise' }))).toEqual({ ok: false, reason: 'action-mismatch' })
    expect(await verifyTurnstile('t', 'chat', 'local', vi.fn(async () => { throw new Error('down') }))).toEqual({ ok: false, reason: 'unreachable' })
  })

  it('runPost answers 403 BOT_CHECK_FAILED before the handler, and passes a verified token through', async () => {
    process.env.TURNSTILE_SECRET_KEY = 's'
    const handler = vi.fn(async () => ({ status: 200, body: { ok: true } }))
    const req = (headers) => ({ method: 'POST', headers: { 'x-real-ip': '5.5.5.5', ...headers }, body: {} })
    const denied = await runPost(req({}), 'chat', handler)
    expect(denied).toEqual({ status: 403, body: { ok: false, error: 'BOT_CHECK_FAILED' } })
    expect(handler).not.toHaveBeenCalled()
    vi.stubGlobal('fetch', reply({ success: true, action: 'chat' }))
    expect((await runPost(req({ 'x-turnstile-token': 'good' }), 'chat', handler)).status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
  })
})
