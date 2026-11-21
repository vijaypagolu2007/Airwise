import { describe, it, expect } from 'vitest'
import { pm25AtHour, bestHour, worstHour } from '../src/lib/airApi.js'
import { makeHourly } from './helpers.js'

describe('hour helpers', () => {
  const hourly = makeHourly()
  it('finds the exact hour', () => expect(pm25AtHour(hourly, '07:00').pm25).toBe(80))
  it('falls back to the closest hour', () => expect(pm25AtHour(hourly, '07:30').time).toBe('2026-11-19T07:00'))
  it('best hour is the cleanest daytime hour', () => expect(bestHour(hourly).time).toBe('2026-11-19T15:00'))
  it('worst hour is the dirtiest daytime hour', () => expect(worstHour(hourly).time).toBe('2026-11-19T07:00'))
})
