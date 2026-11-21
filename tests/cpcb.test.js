import { describe, it, expect } from 'vitest'
import { cpcbAqi, cpcbSubIndex, bandForAqi } from '../src/lib/aqiBands.js'

describe('CPCB AQI', () => {
  it.each([
    [0, 0], [30, 50], [31, 53], [60, 100], [90, 200], [120, 300], [250, 400], [380, 500], [999, 500],
  ])('PM2.5 %d µg/m³ → sub-index %d', (c, idx) => expect(cpcbSubIndex('pm25', c)).toBe(idx))

  it.each([[50, 50], [100, 100], [250, 200], [350, 300], [430, 400]])('PM10 %d → %d', (c, idx) =>
    expect(cpcbSubIndex('pm10', c)).toBe(idx))

  it('ignores missing or invalid readings', () => {
    expect(cpcbSubIndex('pm25', null)).toBeNull()
    expect(cpcbSubIndex('pm25', -1)).toBeNull()
    expect(cpcbAqi(null, undefined)).toBeNull()
  })

  it('takes the worse of PM2.5 and PM10', () => {
    expect(cpcbAqi(40, 300)).toBe(251)
    expect(cpcbAqi(100, 80)).toBe(234)
  })

  it('a US-"Unhealthy" PM2.5 day (110 µg/m³) is Poor on the CPCB scale, not Moderate', () => {
    expect(bandForAqi(cpcbAqi(110, null)).label).toBe('Poor')
  })
})
