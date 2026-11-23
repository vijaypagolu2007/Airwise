// @ts-check
// One /api/advise request per plan key, shared by every view that mounts at the same time
// (and by React StrictMode's double effect run). The entry is dropped once the request settles.
import { postAdvise } from './apiClient.js'
import { fallbackAdvice } from './fallback.js'

/** @typedef {import('./types.js').PlanResult} PlanResult */

/** @type {Map<string, Promise<PlanResult>>} */
const pending = new Map()

/**
 * @param {string} key   stable identity of the plan (city, reading time, profile, language)
 * @param {import('./types.js').AdvisePayload} payload  body for /api/advise
 * @returns {Promise<PlanResult>} the advise response, or a labelled offline fallback if the server can't be reached
 */
export function requestPlan(key, payload) {
  let p = pending.get(key)
  if (!p) {
    p = postAdvise(payload)
      .then((r) => /** @type {PlanResult} */ ({ key, ...r }))
      .catch((e) => ({
        key, offline: e.message, source: 'fallback', prompt: null, raw: null, error: e.message,
        data: fallbackAdvice(payload),
      }))
      .finally(() => pending.delete(key))
    pending.set(key, p)
  }
  return p
}
