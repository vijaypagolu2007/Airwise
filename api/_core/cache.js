// @ts-check
// Advice cache, 60 min TTL: shared via Upstash when configured (kv.js), else a per-instance LRU map.
import { kvPipeline } from './kv.js'

const TTL_MS = 60 * 60 * 1000
const MAX_ENTRIES = 500
/** @type {Map<string, { at: number, value: any }>} */
const store = new Map()

/** @param {string} key @param {number} now */
function memGet(key, now) {
  const hit = store.get(key)
  if (!hit) return undefined
  if (now - hit.at > TTL_MS) {
    store.delete(key)
    return undefined
  }
  // Re-insert so Map order tracks recency (least recently used first).
  store.delete(key)
  store.set(key, hit)
  return hit.value
}

/** @param {string} key @param {any} value @param {number} now */
function memSet(key, value, now) {
  store.delete(key)
  if (store.size >= MAX_ENTRIES) {
    for (const [k, v] of store) if (now - v.at > TTL_MS) store.delete(k) // drop expired entries first
    if (store.size >= MAX_ENTRIES) store.delete(/** @type {string} */ (store.keys().next().value)) // then the LRU one
  }
  store.set(key, { at: now, value })
}

/** @param {string} key @param {number} [now] */
export async function getCache(key, now = Date.now()) {
  const shared = await kvPipeline([['GET', `advice:${key}`]])
  if (shared && typeof shared[0] === 'string') {
    try { return JSON.parse(shared[0]) } catch { /* corrupt entry: fall through */ }
  }
  return memGet(key, now)
}

/** @param {string} key @param {any} value @param {number} [now] */
export async function setCache(key, value, now = Date.now()) {
  memSet(key, value, now)
  await kvPipeline([['SET', `advice:${key}`, JSON.stringify(value), 'PX', TTL_MS]])
}

/** Test hooks. */
export const cacheSize = () => store.size
export const clearCache = () => store.clear()
export const CACHE_LIMITS = { TTL_MS, MAX_ENTRIES }
