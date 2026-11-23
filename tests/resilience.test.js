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
  beforeEach(() => { process.env.GEMINI_API_KEY = 'k'; process.env.AIRWISE_SILENT_LOGS = '1'; process.env.GEMINI_RETRY_MS = '0' })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_FALLBACK_MODEL })

  it('retries the same model once after a 503', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(ok('Walk at 15:00.'))
    const r = await handleChat(chatReq())
    expect(r.body.source).toBe('gemini')
    expect(f).toHaveBeenCalledTimes(2)
    expect(String(f.mock.calls[1][0])).toMatch(/gemini-3\.5-flash-lite/)
  })

  it('switches to the fallback model when the 503 persists', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(ok('Walk at 15:00.'))
    const r = await handleChat(chatReq())
    expect(r.body.source).toBe('gemini')
    expect(f).toHaveBeenCalledTimes(3)
    expect(String(f.mock.calls[2][0])).toMatch(/gemini-3\.1-flash-lite/)
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

describe('normalizeAdvice: small model slips do not discard a good plan', async () => {
  const { normalizeAdvice } = await import('../api/_core/handlers.js')
  const { validateAdvice } = await import('../src/lib/validate.js')
  const base = {
    summary: 'Poor air today.',
    risk_level: 'poor',
    routine: [{ time: '15:00', activity: 'Walk', reason: 'PM2.5 lowest' }, { time: '', activity: 'x', reason: 'y' }],
    indoor_hacks: [{ tip: 'Close windows', why: 'Keeps PM out', effort: 'Medium' }, { tip: 'Mop', why: 'Traps dust', effort: 'LOW effort' }],
    swaps: [
      { id: 'carToMetro', from: 'Car', to: 'Metro', impact_explained: 'Saves CO₂' },
      { id: 'teleport', from: 'a', to: 'b', impact_explained: 'c' },
    ],
    translated: { summary: 'सारांश', topActions: ['a', 'b', 'c', 'd'] },
  }

  it('repairs risk, effort, invented swap ids, blank items and over-long lists', () => {
    const n = normalizeAdvice(base)
    expect(validateAdvice(n).ok).toBe(true)
    expect(n.risk_level).toBe('moderate')
    expect(n.indoor_hacks.map((h) => h.effort)).toEqual(['med', 'low'])
    expect(n.swaps.map((s) => s.id)).toEqual(['carToMetro'])
    expect(n.routine).toHaveLength(1)
    expect(n.translated.topActions).toHaveLength(3)
  })

  it('drops an unusable translation instead of failing', () => {
    expect(normalizeAdvice({ ...base, translated: { summary: '' } }).translated).toBeUndefined()
    expect(normalizeAdvice({ ...base, translated: { summary: 'x', topActions: [] } }).translated).toBeUndefined()
  })

  it('still fails when the core shape is missing', () => {
    expect(validateAdvice(normalizeAdvice({ risk_level: 'low' })).ok).toBe(false)
    expect(normalizeAdvice(null)).toBe(null)
    expect(normalizeAdvice([1])).toEqual([1])
  })
})
