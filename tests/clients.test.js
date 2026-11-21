import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import { searchCity } from '../src/lib/geocode.js'
import { fetchAirQuality } from '../src/lib/airApi.js'
import { postChat } from '../src/lib/apiClient.js'
import * as storage from '../src/lib/storage.js'
import { DEFAULT_PROFILE } from '../src/lib/defaults.js'
import { vercelPost } from '../api/_core/vercel.js'
import { resetRateLimits } from '../api/_core/http.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => vi.restoreAllMocks())

describe('searchCity', () => {
  it('maps results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ results: [{ name: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2, extra: 1 }] }))
    const [d] = await searchCity('Delhi')
    expect(d).toMatchObject({ name: 'Delhi', latitude: 28.6 })
    expect(d.extra).toBeUndefined()
  })
  it.each([
    ['empty results', () => Promise.resolve(json({})), 'CITY_NOT_FOUND'],
    ['HTTP error', () => Promise.resolve(json({}, 500)), 'GEOCODE_FAILED'],
    ['network error', () => Promise.reject(new TypeError('x')), 'GEOCODE_FAILED'],
    ['bad JSON', () => Promise.resolve(new Response('{oops')), 'GEOCODE_FAILED'],
  ])('%s → %s', async (_n, impl, err) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(impl)
    await expect(searchCity('x')).rejects.toThrow(err)
  })
})

describe('fetchAirQuality', () => {
  it('normalises current values and hourly series', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({
      latitude: 28.6, longitude: 77.2, timezone: 'Asia/Kolkata', utc_offset_seconds: 19800,
      current: { time: '2026-11-20T07:00', us_aqi: 163.4, pm2_5: 80.26, pm10: 120, nitrogen_dioxide: 40, ozone: 10, carbon_monoxide: 900, sulphur_dioxide: 5 },
      hourly: { time: ['2026-11-20T07:00', '2026-11-20T08:00'], us_aqi: [163, null], pm2_5: [80.26, 75], pm10: [120, 110], nitrogen_dioxide: [40, 38] },
    }))
    const a = await fetchAirQuality(28.6, 77.2)
    expect(a.current.pm25).toBe(80.3)
    expect(a.hourly).toHaveLength(2)
    // CPCB AQI from PM2.5/PM10, not Open-Meteo's US AQI: 80.3 µg/m³ PM2.5 → 168 (Moderate on the CPCB scale)
    expect(a.current.aqi).toBe(168)
    expect(a.hourly[1].aqi).toBe(151)
  })
  it.each([
    ['HTTP error', () => Promise.resolve(json({}, 503))],
    ['missing hourly', () => Promise.resolve(json({ current: {} }))],
    ['network error', () => Promise.reject(new TypeError('x'))],
  ])('%s → AIR_API_FAILED', async (_n, impl) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(impl)
    await expect(fetchAirQuality(0, 0)).rejects.toThrow('AIR_API_FAILED')
  })
})

describe('apiClient', () => {
  it('throws API_UNREACHABLE when the server cannot be reached or returns non-JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('x')).mockResolvedValueOnce(new Response('<html>'))
    await expect(postChat({})).rejects.toThrow('API_UNREACHABLE')
    await expect(postChat({})).rejects.toThrow('API_UNREACHABLE')
  })
  it('surfaces the server error code and details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: false, error: 'INVALID_REQUEST', details: ['question: empty'] }, 400))
    await expect(postChat({})).rejects.toMatchObject({ message: 'INVALID_REQUEST', details: ['question: empty'] })
  })
})

describe('storage', () => {
  let mem
  beforeEach(() => {
    mem = new Map()
    vi.stubGlobal('localStorage', { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips a profile and merges missing sections with defaults', () => {
    expect(storage.hasSavedProfile()).toBe(false)
    expect(storage.loadProfile()).toEqual(DEFAULT_PROFILE)
    storage.saveProfile({ household: { kids: 2 } })
    expect(storage.loadProfile().household).toEqual({ ...DEFAULT_PROFILE.household, kids: 2 })
    storage.clearProfile()
    expect(storage.hasSavedProfile()).toBe(false)
  })
  it('ignores corrupt profiles and unknown languages', () => {
    mem.set(storage.KEYS.profile, '{bad')
    expect(storage.loadProfile()).toEqual(DEFAULT_PROFILE)
    storage.saveLang('fr')
    expect(storage.loadLang()).toBeNull()
    storage.saveLang('te')
    expect(storage.loadLang()).toBe('te')
    storage.saveCity('Hyderabad')
    expect(storage.loadCity()).toBe('Hyderabad')
  })
  it('survives a throwing localStorage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('full') }, removeItem: () => { throw new Error('x') } })
    expect(() => storage.saveCity('x')).not.toThrow()
    expect(() => storage.clearProfile()).not.toThrow()
    expect(storage.loadCity()).toBeNull()
  })
})

describe('vercelPost adapter', () => {
  beforeEach(() => resetRateLimits())
  const fakeRes = () => {
    const res = { headers: {}, statusCode: 0, body: '' }
    res.setHeader = (k, v) => { res.headers[k] = v }
    res.end = (b) => { res.body = b }
    return res
  }
  it('passes a pre-parsed body through and sets JSON + security headers', async () => {
    const fn = vercelPost('chat', async (body) => ({ status: 200, body: { ok: true, got: body } }))
    const res = fakeRes()
    await fn({ method: 'POST', headers: {}, body: { q: 1 } }, res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).got).toEqual({ q: 1 })
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
    expect(res.headers['Cache-Control']).toBe('no-store')
  })
  it('reads the stream when Vercel has not parsed the body', async () => {
    const fn = vercelPost('advise', async (body) => ({ status: 200, body }))
    const req = Object.assign(Readable.from([Buffer.from('{"a":2}')]), { method: 'POST', headers: {}, body: undefined })
    const res = fakeRes()
    await fn(req, res)
    expect(JSON.parse(res.body)).toEqual({ a: 2 })
  })
})
