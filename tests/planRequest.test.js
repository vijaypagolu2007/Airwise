import { describe, it, expect, vi, afterEach } from 'vitest'
import { requestPlan } from '../src/lib/planRequest.js'
import { DEFAULT_PROFILE } from '../src/lib/defaults.js'
import { makeHourly } from './helpers.js'

const payload = { location: { name: 'Delhi' }, aqiNow: { aqi: 320, pm25: 180 }, forecast24: makeHourly(), profile: DEFAULT_PROFILE }

describe('requestPlan', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shares one request between concurrent callers for the same key', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, source: 'gemini', data: {} })))
    const [a, b] = await Promise.all([requestPlan('k1', payload), requestPlan('k1', payload)])
    expect(f).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(a.key).toBe('k1')
  })

  it('returns a labelled offline fallback when the server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const r = await requestPlan('k2', payload)
    expect(r.offline).toBe('API_UNREACHABLE')
    expect(r.source).toBe('fallback')
    expect(r.data.risk_level).toBe('severe')
  })
})
