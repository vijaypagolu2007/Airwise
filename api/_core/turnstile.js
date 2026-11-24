// @ts-check
// Optional Cloudflare Turnstile check. Origin headers stop other websites, but a script can forge them;
// a Turnstile token proves a real browser solved the challenge on our page. Off when TURNSTILE_SECRET_KEY
// is unset (local dev, tests), so the app still runs without a Cloudflare account.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

/** True when the server will demand a token. */
export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY)

/**
 * Verify one single-use token. Fails closed: a missing, wrong, reused, expired or unverifiable token is refused.
 * @param {string} token   value of the x-turnstile-token header
 * @param {'advise' | 'chat'} action  must match the action the widget was rendered with
 * @param {string} [ip]
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function verifyTurnstile(token, action, ip, fetchImpl = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true }
  if (!token || token.length > 2048) return { ok: false, reason: 'missing' }
  const form = new URLSearchParams({ secret, response: token })
  if (ip && ip !== 'local') form.set('remoteip', ip)
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT_MS) })
    const out = /** @type {{ success?: boolean, action?: string, 'error-codes'?: string[] }} */ (await res.json())
    if (!out.success) return { ok: false, reason: (out['error-codes'] || ['rejected']).join(',') }
    if (out.action && out.action !== action) return { ok: false, reason: 'action-mismatch' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}
