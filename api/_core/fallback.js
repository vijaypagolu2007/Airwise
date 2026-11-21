// @ts-check
// Server-side rule-based fallback. Re-uses the browser module (pure, no DOM access) so the
// rules stay identical in both places. Vercel bundles the cross-directory import.
import { fallbackAdvice } from '../../src/lib/fallback.js'

/** @param {Parameters<typeof fallbackAdvice>[0]} input */
export function serverFallback(input) {
  return fallbackAdvice(input)
}
