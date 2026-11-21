// @ts-check
// Per-instance in-memory cache, 60 min TTL. Enough to protect the Gemini free-tier quota.
const TTL_MS = 60 * 60 * 1000
/** @type {Map<string, { at: number, value: any }>} */
const store = new Map()

/** @param {string} key */
export function getCache(key) {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key)
    return undefined
  }
  return hit.value
}

/** @param {string} key @param {any} value */
export function setCache(key, value) {
  if (store.size > 500) store.delete(/** @type {string} */ (store.keys().next().value))
  store.set(key, { at: Date.now(), value })
}
