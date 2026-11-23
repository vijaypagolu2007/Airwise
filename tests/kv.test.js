import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { kvEnabled, kvPipeline } from '../api/_core/kv.js'
import { checkRateLimit, resetRateLimits, RATE_LIMITS } from '../api/_core/http.js'
import { getCache, setCache, clearCache, cacheSize, CACHE_LIMITS } from '../api/_core/cache.js'

const URL_ = 'https://kv.example.upstash.io'
const on = () => { process.env.UPSTASH_REDIS_REST_URL = URL_ + '/'; process.env.UPSTASH_REDIS_REST_TOKEN = 't0k' }
const off = () => { delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN }
const reply = (body, ok = true) => vi.fn(async () => ({ ok, json: async () => body }))

describe('kv (Upstash REST)', () => {
  beforeEach(() => { off(); resetRateLimits(); clearCache() })
  afterEach(() => { off(); vi.unstubAllGlobals() })

  it('is off without both env vars and never calls fetch', async () => {
    const f = reply([])
    vi.stubGlobal('fetch', f)
    expect(kvEnabled()).toBe(false)
    expect(await kvPipeline([['GET', 'x']])).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('sends one pipeline request with the bearer token', async () => {
    on()
    const f = reply([{ result: 1 }, { result: 'OK' }])
    vi.stubGlobal('fetch', f)
    expect(await kvPipeline([['INCR', 'k'], ['PEXPIRE', 'k', 60000]])).toEqual([1, 'OK'])
    const [url, init] = f.mock.calls[0]
    expect(url).toBe(`${URL_}/pipeline`)
    expect(init.headers.Authorization).toBe('Bearer t0k')
    expect(JSON.parse(init.body)).toEqual([['INCR', 'k'], ['PEXPIRE', 'k', 60000]])
  })

  it('returns null on HTTP errors, command errors and network failures', async () => {
    on()
    vi.stubGlobal('fetch', reply([], false))
    expect(await kvPipeline([['GET', 'x']])).toBeNull()
    vi.stubGlobal('fetch', reply([{ error: 'WRONGTYPE' }]))
    expect(await kvPipeline([['GET', 'x']])).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    expect(await kvPipeline([['GET', 'x']])).toBeNull()
  })

  it('rate limit uses the shared counter when the store answers', async () => {
    on()
    vi.stubGlobal('fetch', reply([{ result: RATE_LIMITS.chat }, { result: 1 }]))
    expect((await checkRateLimit('chat', 'ip', 30_000)).ok).toBe(true)
    vi.stubGlobal('fetch', reply([{ result: RATE_LIMITS.chat + 1 }, { result: 1 }]))
    expect(await checkRateLimit('chat', 'ip', 30_000)).toEqual({ ok: false, retryAfterSec: 30 })
  })

  it('rate limit falls back to memory when the store fails', async () => {
    on()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    for (let i = 0; i < RATE_LIMITS.advise; i++) expect((await checkRateLimit('advise', 'ip', 0)).ok).toBe(true)
    expect((await checkRateLimit('advise', 'ip', 0)).ok).toBe(false)
  })

  it('cache reads a shared hit, ignores a corrupt one, and writes with a TTL', async () => {
    on()
    vi.stubGlobal('fetch', reply([{ result: JSON.stringify({ data: 1 }) }]))
    expect(await getCache('k')).toEqual({ data: 1 })
    vi.stubGlobal('fetch', reply([{ result: '{corrupt' }]))
    expect(await getCache('k')).toBeUndefined()
    const f = reply([{ result: 'OK' }])
    vi.stubGlobal('fetch', f)
    await setCache('k', { data: 2 })
    expect(JSON.parse(f.mock.calls[0][1].body)[0]).toEqual(['SET', 'advice:k', '{"data":2}', 'PX', CACHE_LIMITS.TTL_MS])
  })
})

describe('memory cache', () => {
  beforeEach(() => { off(); clearCache() })

  it('expires entries after the TTL', async () => {
    await setCache('a', 1, 0)
    expect(await getCache('a', CACHE_LIMITS.TTL_MS)).toBe(1)
    expect(await getCache('a', CACHE_LIMITS.TTL_MS + 1)).toBeUndefined()
  })

  it('evicts expired entries first, then the least recently used', async () => {
    const { MAX_ENTRIES, TTL_MS } = CACHE_LIMITS
    await setCache('old', 'x', 0)
    for (let i = 1; i < MAX_ENTRIES; i++) await setCache(`k${i}`, i, TTL_MS)
    await setCache('new', 'y', TTL_MS + 1) // 'old' expired: it goes, nothing live is lost
    expect(cacheSize()).toBe(MAX_ENTRIES)
    expect(await getCache('k1', TTL_MS + 1)).toBe(1) // touch k1 so k2 is now least recent
    await setCache('newer', 'z', TTL_MS + 2)
    expect(await getCache('k1', TTL_MS + 2)).toBe(1)
    expect(await getCache('k2', TTL_MS + 2)).toBeUndefined()
  })
})
