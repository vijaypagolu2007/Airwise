import { describe, it, expect } from 'vitest'
import { bandForAqi, aqiToRisk } from '../src/lib/aqiBands.js'

describe('bandForAqi', () => {
  it.each([
    [50, 'Good'], [51, 'Satisfactory'], [100, 'Satisfactory'], [101, 'Moderate'],
    [200, 'Moderate'], [201, 'Poor'], [300, 'Poor'], [301, 'Very Poor'],
    [400, 'Very Poor'], [401, 'Severe'], [500, 'Severe'], [999, 'Severe'],
  ])('%i → %s', (aqi, label) => expect(bandForAqi(aqi).label).toBe(label))
})

describe('aqiToRisk', () => {
  it.each([[100, 'low'], [101, 'moderate'], [200, 'moderate'], [201, 'high'], [300, 'high'], [301, 'severe']])(
    '%i → %s',
    (aqi, risk) => expect(aqiToRisk(aqi)).toBe(risk),
  )
})
