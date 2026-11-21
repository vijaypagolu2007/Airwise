// @ts-check
// Framework-free request logic shared by the Vercel functions (api/*.js) and the local server.js.
// Each handler takes a parsed JSON body and returns { status, body }; transport concerns live in http.js.

import { validateAdviseRequest, validateChatRequest, validateAdvice } from '../../src/lib/validate.js'
import { aqiToRisk, bandForAqi, cpcbAqi } from '../../src/lib/aqiBands.js'
import { computeAllSwaps, computeExposureSummary } from '../../src/lib/impact.js'
import { buildAdvisePrompt, buildChatPrompt } from './prompt.js'
import { callGeminiJson, callGeminiText, modelName } from './gemini.js'
import { getCache, setCache } from './cache.js'
import { serverFallback } from './fallback.js'
import { log } from './http.js'

/** Temperatures: advice is structured and health-adjacent, so keep it low; chat a little warmer for natural wording. */
const ADVICE_TEMPERATURE = 0.4
const CHAT_TEMPERATURE = 0.5

/**
 * Keep only swaps that reference an applicable code-computed swap, once each, so every number the UI shows
 * next to Gemini's words comes from src/lib/impact.js and matches the habit it describes.
 * @param {{ id: string }[]} swaps
 * @param {unknown} computedImpacts
 */
export function groundSwaps(swaps, computedImpacts) {
  const computed = /** @type {{ swaps?: { id: string, applicable?: boolean }[] } | undefined} */ (computedImpacts)?.swaps
  if (!Array.isArray(computed)) return swaps
  const allowed = new Set(computed.filter((s) => s.applicable).map((s) => s.id))
  const seen = new Set()
  return swaps.filter((s) => allowed.has(s.id) && !seen.has(s.id) && seen.add(s.id))
}

/**
 * Server-side grounding: AQI is recomputed on the CPCB scale from the pollutant readings, and every impact
 * number is computed here from the validated profile, so nothing the client claims reaches the prompt unchecked.
 * @template {{ aqiNow: { aqi: number, pm25: number, pm10?: number | null }, forecast24: import('../../src/lib/types.js').HourEntry[], profile: any }} T
 * @param {T} input
 */
export function groundInput(input) {
  const aqiNow = { ...input.aqiNow, aqi: cpcbAqi(input.aqiNow.pm25, input.aqiNow.pm10) ?? input.aqiNow.aqi }
  const forecast24 = input.forecast24.map((e) => ({ ...e, aqi: cpcbAqi(e.pm25, e.pm10) ?? e.aqi }))
  const swaps = computeAllSwaps(input.profile, forecast24)
  const applicable = swaps.filter((s) => s.applicable).map((s) => s.id)
  const computedImpacts = { swaps, exposure: computeExposureSummary(input.profile, forecast24, applicable) }
  return { ...input, aqiNow, forecast24, computedImpacts }
}

/**
 * Error codes safe to show users. Anything else (HTTP status details, schema messages) stays in the server log.
 * @param {unknown} e
 */
export function publicError(e) {
  const m = e instanceof Error ? e.message : String(e)
  if (m === 'NO_API_KEY') return 'AI_NOT_CONFIGURED'
  if (m === 'GEMINI_TIMEOUT') return 'AI_TIMEOUT'
  if (m === 'GEMINI_HTTP_429') return 'AI_BUSY'
  if (m.startsWith('SCHEMA_FAIL') || m === 'GEMINI_BAD_JSON' || m === 'GEMINI_EMPTY') return 'AI_OUTPUT_INVALID'
  return 'AI_UNAVAILABLE'
}

/** @param {unknown} body */
export async function handleAdvise(body) {
  const v = validateAdviseRequest(body)
  if (!v.ok) return { status: 400, body: { ok: false, error: 'INVALID_REQUEST', details: v.errors } }
  const input = groundInput(v.data)
  const lang = input.lang || 'en'
  // AQI bucketed by 10 so nearby readings share a plan and protect the free-tier quota (60-min TTL).
  const cacheKey = `${input.location.name}|${lang}|${Math.round(input.aqiNow.aqi / 10)}|${JSON.stringify(input.profile)}`
  const prompt = buildAdvisePrompt(input)

  const cached = getCache(cacheKey)
  if (cached) {
    log('advise', 'ok', { source: 'gemini', cached: true })
    return { status: 200, body: { ok: true, source: 'gemini', cached: true, ...cached } }
  }

  try {
    const { text, raw } = await callGeminiJson(prompt, ADVICE_TEMPERATURE)
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('GEMINI_BAD_JSON')
    }
    const checked = validateAdvice(parsed)
    if (!checked.ok) throw new Error('SCHEMA_FAIL: ' + checked.errors.slice(0, 3).join('; '))
    // Risk level comes from the CPCB band in code, never from the model, so the badge and the bands agree.
    const data = { ...checked.data, risk_level: aqiToRisk(input.aqiNow.aqi), swaps: groundSwaps(checked.data.swaps, input.computedImpacts) }
    if (lang === 'en') delete data.translated
    setCache(cacheKey, { data, prompt, raw })
    log('advise', 'ok', { source: 'gemini', cached: false })
    return { status: 200, body: { ok: true, source: 'gemini', cached: false, data, prompt, raw } }
  } catch (e) {
    log('advise', 'fallback', { error: e instanceof Error ? e.message : String(e) })
    return { status: 200, body: { ok: true, source: 'fallback', cached: false, data: serverFallback(input), prompt, raw: null, error: publicError(e) } }
  }
}

/** @type {Record<string, string>} */
const BAND_ADVICE = {
  Good: 'outdoor activities are fine for everyone',
  Satisfactory: 'outdoor activities are fine, though very sensitive people should avoid heavy traffic',
  Moderate: 'sensitive groups should shorten strenuous outdoor activity',
  Poor: 'everyone should reduce outdoor exertion and sensitive groups should stay indoors',
  'Very Poor': 'avoid outdoor exercise, wear an N95 outside and keep windows closed',
  Severe: 'stay indoors as much as possible with filtered air and wear an N95 if you must go out',
}

/** @param {unknown} body */
export async function handleChat(body) {
  const v = validateChatRequest(body)
  if (!v.ok) return { status: 400, body: { ok: false, error: 'INVALID_REQUEST', details: v.errors } }
  const input = groundInput(v.data)
  const prompt = buildChatPrompt(input)
  try {
    const { text } = await callGeminiText(prompt, CHAT_TEMPERATURE)
    log('chat', 'ok', { source: 'gemini' })
    return { status: 200, body: { ok: true, source: 'gemini', reply: text, prompt } }
  } catch (e) {
    const aqi = Math.round(input.aqiNow.aqi)
    const band = bandForAqi(aqi).label
    const reply = `I couldn't reach the AI model right now. Rule-based answer: the AQI in ${input.location.name} is ${aqi} (${band}, ${aqiToRisk(aqi)} risk), so ${BAND_ADVICE[band]}. For health symptoms please consult a doctor.`
    log('chat', 'fallback', { error: e instanceof Error ? e.message : String(e) })
    return { status: 200, body: { ok: true, source: 'fallback', reply, prompt, error: publicError(e) } }
  }
}

export function handleHealth() {
  return { status: 200, body: { ok: true, geminiConfigured: !!process.env.GEMINI_API_KEY, model: modelName() } }
}
