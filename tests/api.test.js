import { describe, it, expect, beforeEach } from 'vitest'
import { handleAdvise, handleChat, handleHealth } from '../api/_core/handlers.js'
import { DEFAULT_PROFILE } from '../src/lib/defaults.js'
import { makeHourly } from './helpers.js'

const req = { location: { name: 'Delhi' }, aqiNow: { aqi: 320, pm25: 180 }, forecast24: makeHourly(), profile: DEFAULT_PROFILE }

describe('API handlers without a Gemini key', () => {
  beforeEach(() => { delete process.env.GEMINI_API_KEY })
  it('invalid advise request → 400', async () => {
    const r = await handleAdvise({})
    expect(r.status).toBe(400)
  })
  it('advise falls back to rule-based advice, never 5xx', async () => {
    const r = await handleAdvise(req)
    expect(r.status).toBe(200)
    expect(r.body.source).toBe('fallback')
    expect(r.body.error).toBe('AI_NOT_CONFIGURED')
    expect(r.body.prompt).toMatch(/Today's data/)
    expect(r.body.data.risk_level).toBe('severe')
  })
  it('chat falls back with a rule-based reply', async () => {
    const r = await handleChat({ ...req, question: 'Can my kid play outside at 5 pm?' })
    expect(r.body.source).toBe('fallback')
    expect(r.body.reply).toMatch(/AQI in Delhi is 347 \(Very Poor/)
  })
  it('health reports missing key', () => expect(handleHealth().body.geminiConfigured).toBe(false))
  it('health reports whether the shared store is on, as a boolean only', () => expect(handleHealth().body.sharedStore).toBe(false))
})
