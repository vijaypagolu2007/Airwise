import { describe, it, expect } from 'vitest'
import {
  exposureUg, commuteMinutes, indoorConc, householdRate,
  computeAllSwaps, computeExposureSummary,
} from '../src/lib/impact.js'
import { DEFAULT_PROFILE } from '../src/lib/defaults.js'
import { makeHourly } from './helpers.js'

const profile = (patch = {}) => ({
  ...structuredClone(DEFAULT_PROFILE),
  ...patch,
  commute: { ...DEFAULT_PROFILE.commute, ...(patch.commute || {}) },
})

describe('impact math (hand-calculated)', () => {
  it('exposureUg', () => {
    expect(exposureUg(100, 60, 12)).toBe(72)
    expect(exposureUg(180, 45, 12.5, 3)).toBe(303.8)
  })
  it('commuteMinutes', () => {
    expect(commuteMinutes('metro', 8)).toBe(16)
    expect(commuteMinutes('walk', 8)).toBe(96)
  })
  it('indoorConc', () => {
    expect(indoorConc(200, 'lpg')).toBe(160)
    expect(indoorConc(200, 'wood')).toBe(370)
  })
  it('householdRate', () => {
    expect(householdRate({ household: { adults: 2, kids: 1, elderly: 0, pregnant: false } })).toBe(11.3)
    expect(householdRate({ household: { adults: 0, kids: 0, elderly: 0 } })).toBe(12)
  })
  it('carToMetro numbers for an 8 km car commute', () => {
    const s = computeAllSwaps(profile({ commute: { mode: 'car', distanceKm: 8 } }), makeHourly()).find((x) => x.id === 'carToMetro')
    expect(s.applicable).toBe(true)
    expect(s.co2KgPerWeek).toBe(12.6)
    expect(s.moneySavedPerMonth).toBe(2880)
  })
  it('walkShift cut = exposure(80) − exposure(40)', () => {
    const p = profile()
    const rate = householdRate(p)
    const s = computeAllSwaps(p, makeHourly()).find((x) => x.id === 'walkShift')
    expect(s.to).toBe('Walk at 15:00')
    expect(s.exposureCutUgPerDay).toBeCloseTo(exposureUg(80, 45, rate, 3) - exposureUg(40, 45, rate, 3), 1)
  })
  it('returns all five swaps including non-applicable ones', () => {
    const swaps = computeAllSwaps(profile(), makeHourly())
    expect(swaps.map((s) => s.id)).toEqual(['walkShift', 'carToMetro', 'fuelSwap', 'purifier', 'wasteToCompost'])
    expect(swaps.find((s) => s.id === 'carToMetro').applicable).toBe(false)
  })
  it('exposure summary: before ≥ after, swaps reduce the total', () => {
    const p = profile({ commute: { mode: 'car', distanceKm: 8 } })
    const none = computeExposureSummary(p, makeHourly())
    expect(none.before.totalUg).toBeGreaterThanOrEqual(none.after.totalUg)
    const some = computeExposureSummary(p, makeHourly(), ['carToMetro', 'walkShift'])
    expect(some.after.totalUg).toBeLessThan(some.before.totalUg)
    expect(some.cutPercent).toBeGreaterThan(0)
  })
})
