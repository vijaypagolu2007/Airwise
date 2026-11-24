// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'

async function fresh() {
  vi.resetModules()
  return import('../../src/lib/turnstile.js')
}

/** Make the next <script> the module appends "load" with a fake window.turnstile. */
function fakeCloudflare(behaviour) {
  const remove = vi.fn()
  const render = vi.fn((el, opts) => { queueMicrotask(() => behaviour(opts)); return 'w1' })
  const orig = document.head.appendChild.bind(document.head)
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    if (node instanceof HTMLScriptElement) {
      expect(node.src).toContain('challenges.cloudflare.com/turnstile/v0/api.js')
      window.turnstile = { render, remove }
      queueMicrotask(() => node.onload?.(new Event('load')))
      return node
    }
    return orig(node)
  })
  return { render, remove }
}

describe('Turnstile (browser)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); delete window.turnstile })

  it('returns null and loads nothing when no site key is configured', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    const spy = vi.spyOn(document.head, 'appendChild')
    const { getTurnstileToken } = await fresh()
    expect(await getTurnstileToken('chat')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('renders an invisible widget with the action, resolves its token, then cleans up', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site')
    const cf = fakeCloudflare((opts) => opts.callback('tok-1'))
    const { getTurnstileToken } = await fresh()
    expect(await getTurnstileToken('advise')).toBe('tok-1')
    expect(cf.render.mock.calls[0][1]).toMatchObject({ sitekey: 'site', action: 'advise', appearance: 'interaction-only' })
    expect(cf.remove).toHaveBeenCalledWith('w1')
    expect(document.body.querySelector('.fixed')).toBeNull()
  })

  it('rejects with BOT_CHECK_FAILED when the widget errors', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site')
    fakeCloudflare((opts) => opts['error-callback']())
    const { getTurnstileToken } = await fresh()
    await expect(getTurnstileToken('chat')).rejects.toThrow('BOT_CHECK_FAILED')
  })

  it('apiClient sends the token as x-turnstile-token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site')
    fakeCloudflare((opts) => opts.callback('tok-2'))
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, reply: 'hi' }) }))
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const { postChat } = await import('../../src/lib/apiClient.js')
    await postChat({ question: 'q' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/chat')
    expect(init.headers['x-turnstile-token']).toBe('tok-2')
    vi.unstubAllGlobals()
  })
})
