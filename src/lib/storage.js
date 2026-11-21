// @ts-check
// AirWise local storage helpers. Binding contract: docs/CONTRACT.md §6.
import { DEFAULT_PROFILE, LANGUAGES } from './defaults.js'

export const KEYS = { profile: 'airwise.profile.v1', city: 'airwise.city.v1', lang: 'airwise.lang.v1' }

const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null)

/** @param {string} key */
function safeGet(key) {
  try {
    return ls()?.getItem(key) ?? null
  } catch {
    return null
  }
}
/** @param {string} key @param {string} value */
function safeSet(key, value) {
  try {
    ls()?.setItem(key, value)
  } catch {
    /* storage full or disabled */
  }
}

export function loadProfile() {
  const raw = safeGet(KEYS.profile)
  if (!raw) return structuredClone(DEFAULT_PROFILE)
  try {
    const p = JSON.parse(raw)
    return {
      ...DEFAULT_PROFILE,
      ...p,
      household: { ...DEFAULT_PROFILE.household, ...(p.household || {}) },
      commute: { ...DEFAULT_PROFILE.commute, ...(p.commute || {}) },
      home: { ...DEFAULT_PROFILE.home, ...(p.home || {}) },
      outdoor: { ...DEFAULT_PROFILE.outdoor, ...(p.outdoor || {}) },
    }
  } catch {
    return structuredClone(DEFAULT_PROFILE)
  }
}
export function hasSavedProfile() {
  return !!safeGet(KEYS.profile)
}
/** @param {import('./types.js').Profile} p */
export function saveProfile(p) {
  safeSet(KEYS.profile, JSON.stringify(p))
}
export function clearProfile() {
  try {
    ls()?.removeItem(KEYS.profile)
  } catch {
    /* ignore */
  }
}
export function loadCity() {
  return safeGet(KEYS.city)
}
/** @param {string} name */
export function saveCity(name) {
  safeSet(KEYS.city, String(name))
}
export function loadLang() {
  const l = safeGet(KEYS.lang)
  return l && LANGUAGES.includes(l) ? l : null
}
/** @param {string} l */
export function saveLang(l) {
  if (LANGUAGES.includes(l)) safeSet(KEYS.lang, l)
}
