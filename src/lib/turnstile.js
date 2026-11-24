// @ts-check
// Browser side of the optional Turnstile check. When VITE_TURNSTILE_SITE_KEY is set at build time, each
// /api call first gets a fresh single-use token from an invisible widget (it only shows a checkbox if
// Cloudflare is unsure). With no site key this returns null and requests go out as before.

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TOKEN_TIMEOUT_MS = 30_000

/**
 * @typedef {{
 *   render: (el: HTMLElement, opts: Record<string, unknown>) => string,
 *   remove: (id: string) => void,
 * }} TurnstileApi
 */

/** @type {Promise<TurnstileApi> | null} */
let loading = null

/** @returns {Promise<TurnstileApi>} */
function loadScript() {
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_URL
      s.async = true
      s.onload = () => {
        const api = /** @type {{ turnstile?: TurnstileApi }} */ (/** @type {unknown} */ (window)).turnstile
        if (api) resolve(api)
        else reject(new Error('BOT_CHECK_FAILED'))
      }
      s.onerror = () => { loading = null; reject(new Error('BOT_CHECK_FAILED')) }
      document.head.appendChild(s)
    })
  }
  return loading
}

/** Site key baked in at build time, or '' when the check is off. */
export const siteKey = () => import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

/**
 * @param {'advise' | 'chat'} action
 * @returns {Promise<string | null>} a token, or null when Turnstile is not configured
 */
export async function getTurnstileToken(action) {
  const sitekey = siteKey()
  if (!sitekey) return null
  const api = await loadScript()
  const host = document.createElement('div')
  host.className = 'fixed bottom-4 right-4 z-50'
  document.body.appendChild(host)
  /** @type {string | undefined} */
  let id
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('BOT_CHECK_FAILED')), TOKEN_TIMEOUT_MS)
      const fail = () => { clearTimeout(timer); reject(new Error('BOT_CHECK_FAILED')) }
      id = api.render(host, {
        sitekey,
        action,
        appearance: 'interaction-only',
        callback: (/** @type {string} */ token) => { clearTimeout(timer); resolve(token) },
        'error-callback': fail,
        'expired-callback': fail,
        'timeout-callback': fail,
      })
    })
  } finally {
    if (id) api.remove(id)
    host.remove()
  }
}
