// @ts-check
// Minimal Gemini REST client (Google AI Studio free tier). Key stays server-side.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-lite'
const TIMEOUT_MS = 25000
/** Overloaded, rate-limited or flaky upstream: worth one more try on another model. */
const RETRYABLE = /^GEMINI_(HTTP_(429|500|502|503|504)|NETWORK)$/

export const modelName = () => process.env.GEMINI_MODEL || DEFAULT_MODEL
export const fallbackModelName = () => process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL

/** The model sometimes mangles the superscript in µg/m³; put it back. @param {string} t */
export const fixUnits = (t) => t.replace(/µg\/m(?:_+|\^?3)(?![\d³])/g, 'µg/m³')

/** @param {string} text */
function stripFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/**
 * @param {string} model
 * @param {string} prompt
 * @param {Record<string, unknown>} generationConfig
 * @returns {Promise<{ text: string, raw: string }>}
 */
async function callModel(model, prompt, generationConfig) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('NO_API_KEY')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }),
      signal: ctrl.signal,
    })
  } catch (e) {
    throw new Error(e instanceof Error && e.name === 'AbortError' ? 'GEMINI_TIMEOUT' : 'GEMINI_NETWORK')
  } finally {
    clearTimeout(timer)
  }

  const bodyText = await res.text()
  if (!res.ok) throw new Error('GEMINI_HTTP_' + res.status)
  let body
  try {
    body = JSON.parse(bodyText)
  } catch {
    throw new Error('GEMINI_BAD_BODY')
  }
  const parts = body?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('GEMINI_EMPTY')
  const text = fixUnits(stripFences(parts.map((/** @type {{ text?: string }} */ p) => p.text || '').join('')))
  if (!text) throw new Error('GEMINI_EMPTY')
  return { text, raw: bodyText }
}

/**
 * Primary model first; on an overload, rate limit or network error, one try on the fallback model.
 * @param {string} prompt
 * @param {Record<string, unknown>} generationConfig
 * @returns {Promise<{ text: string, raw: string }>}
 */
async function call(prompt, generationConfig) {
  try {
    return await callModel(modelName(), prompt, generationConfig)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const fb = fallbackModelName()
    if (!RETRYABLE.test(msg) || !fb || fb === modelName()) throw e
    return await callModel(fb, prompt, generationConfig)
  }
}

/** JSON-mode call: returns { text, raw }. */
/** @param {string} prompt @param {number} temperature */
export function callGeminiJson(prompt, temperature) {
  return call(prompt, { responseMimeType: 'application/json', temperature })
}

/** Plain-text call for chat: returns { text, raw }. */
/** @param {string} prompt @param {number} temperature */
export function callGeminiText(prompt, temperature) {
  return call(prompt, { temperature })
}
