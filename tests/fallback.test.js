import { describe, it, expect } from 'vitest'
import { fallbackAdvice } from '../src/lib/fallback.js'
import { validateAdvice } from '../src/lib/validate.js'
import { computeAllSwaps } from '../src/lib/impact.js'
import { DEFAULT_PROFILE } from '../src/lib/defaults.js'
import { makeHourly } from './helpers.js'

const base = (aqi, profile = DEFAULT_PROFILE) => ({
  location: { name: 'Delhi' },
  aqiNow: { aqi, pm25: aqi / 2 },
  forecast24: makeHourly(),
  profile,
})

describe('fallbackAdvice', () => {
  it('matches the advice schema', () => {
    expect(validateAdvice(fallbackAdvice(base(150))).ok).toBe(true)
  })
  it('routine is sorted by time', () => {
    const p = { ...structuredClone(DEFAULT_PROFILE), household: { ...DEFAULT_PROFILE.household, kids: 1 }, outdoor: { ...DEFAULT_PROFILE.outdoor, schoolRun: true, sports: true } }
    const times = fallbackAdvice(base(250, p)).routine.map((r) => r.time)
    expect(times).toEqual([...times].sort())
  })
  it('severe air → severe risk, mask / windows closed advice', () => {
    const p = { ...structuredClone(DEFAULT_PROFILE), household: { ...DEFAULT_PROFILE.household, kids: 1 }, outdoor: { ...DEFAULT_PROFILE.outdoor, schoolRun: true } }
    const a = fallbackAdvice(base(420, p))
    expect(a.risk_level).toBe('severe')
    const text = JSON.stringify(a).toLowerCase()
    expect(text).toMatch(/mask/)
    expect(text).toMatch(/windows closed/)
  })
  it('cites computed numbers when impacts are provided', () => {
    const p = { ...structuredClone(DEFAULT_PROFILE), commute: { mode: 'car', distanceKm: 8, time: '09:00' } }
    const swaps = computeAllSwaps(p, makeHourly())
    const a = fallbackAdvice({ ...base(250, p), computedImpacts: { swaps } })
    expect(a.swaps.find((s) => s.from.startsWith('car')).impact_explained).toMatch(/12\.6 kg/)
  })
})
