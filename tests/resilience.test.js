import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { handleChat, handleHealth } from '../api/_core/handlers.js'
import { fixUnits } from '../api/_core/gemini.js'
import { vercelPost } from '../api/_core/vercel.js'
import { DEFAULT_PROFILE } from '../src/lib/defaults.js'
import { makeHourly } from './helpers.js'

const chatReq = () => ({
  location: { name: 'Pune' }, aqiNow: { aqi: 150, pm25: 60 }, forecast24: makeHourly(),
  profile: { ...DEFAULT_PROFILE, city: 'Pune' }, question: 'Can I walk now?',
})
const ok = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })

describe('model fallback', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'k'; process.env.AIRWISE_SILENT_LOGS = '1' })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_FALLBACK_MODEL })

  it('retries once on the fallback model after a 503', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(ok('Walk at 15:00.'))
    const r = await handleChat(chatReq())
    expect(r.body.source).toBe('gemini')
    expect(f).toHaveBeenCalledTimes(2)
    expect(String(f.mock.calls[1][0])).toMatch(/gemini-3\.1-flash-lite/)
  })

  it('does not retry on a 400 (bad request is not transient)', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }))
    const r = await handleChat(chatReq())
    expect(r.body.source).toBe('fallback')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('falls back to rule-based text when both models fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 503 }))
    const r = await handleChat(chatReq())
    expect(r.body.source).toBe('fallback')
  })
})

describe('output and config hygiene', () => {
  it('repairs mangled µg/m³ units', () => {
    expect(fixUnits('PM2.5 at 40 µg/m__, and 60 µg/m^3')).toBe('PM2.5 at 40 µg/m³, and 60 µg/m³')
    expect(fixUnits('already 15 µg/m³')).toBe('already 15 µg/m³')
  })

  it('health never echoes a value that is not a model name (e.g. a key pasted into GEMINI_MODEL)', async () => {
    process.env.GEMINI_MODEL = 'AQ.Ab8_secret/key'
    const r = await handleHealth()
    expect(r.body.model).toBe('INVALID_MODEL_NAME')
    delete process.env.GEMINI_MODEL
  })
})

describe('vercel adapter', () => {
  it('answers malformed JSON with INVALID_JSON when the body getter throws', async () => {
    const fn = vercelPost('chat', async () => ({ status: 200, body: {} }))
    const req = { method: 'POST', headers: {}, socket: { remoteAddress: '9.9.9.9' } }
    Object.defineProperty(req, 'body', { get() { throw new Error('Invalid JSON') } })
    const res = { headers: {}, statusCode: 0, out: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.out = b } }
    await fn(req, res)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.out).error).toBe('INVALID_JSON')
  })
})
