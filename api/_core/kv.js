// @ts-check
// Optional shared store for rate limits and the advice cache, via the Upstash Redis REST API (plain fetch, no SDK).
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to share state across serverless instances and cold starts.
// Unset, or on any store error, callers fall back to their per-instance in-memory maps, so the app never depends on it.

const TIMEOUT_MS = 1500

export function kvEnabled() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Run Redis commands in one round trip. Returns each command's result, or null when the store is off or failing.
 * @param {(string | number)[][]} commands
 * @returns {Promise<unknown[] | null>}
 */
export async function kvPipeline(commands) {
  if (!kvEnabled()) return null
  try {
    const res = await fetch(`${String(process.env.UPSTASH_REDIS_REST_URL).replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const out = /** @type {{ result?: unknown, error?: string }[]} */ (await res.json())
    if (!Array.isArray(out) || out.some((r) => r && r.error)) return null
    return out.map((r) => r.result)
  } catch {
    return null
  }
}
