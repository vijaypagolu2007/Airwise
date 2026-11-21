import { describe, it, expect } from 'vitest'
import { validateAdvice, validateProfile, validateAdviseRequest, validateChatRequest } from '../src/lib/validate.js'
import { DEFAULT_PROFILE } from '../src/lib/defaults.js'

const advice = {
  summary: 'Air is poor.',
  risk_level: 'high',
  routine: [{ time: '07:00', activity: 'Walk', reason: 'Clean hour' }],
  indoor_hacks: [{ tip: 'Seal gaps', why: 'Less infiltration', effort: 'low' }],
  swaps: [{ id: 'carToMetro', from: 'Car', to: 'Metro', impact_explained: 'Less CO2' }],
}

describe('validate', () => {
  it('valid advice passes', () => expect(validateAdvice(advice).ok).toBe(true))
  it('missing summary fails', () => {
    const rest = { ...advice }
    delete rest.summary
    const r = validateAdvice(rest)
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toMatch(/summary/)
  })
  it('bad effort fails', () => expect(validateAdvice({ ...advice, indoor_hacks: [{ tip: 'x', why: 'y', effort: 'huge' }] }).ok).toBe(false))
  it('bad risk fails', () => expect(validateAdvice({ ...advice, risk_level: 'apocalyptic' }).ok).toBe(false))
  it('profile schema accepts defaults and rejects kids:-1', () => {
    expect(validateProfile(DEFAULT_PROFILE).ok).toBe(true)
    expect(validateProfile({ ...DEFAULT_PROFILE, household: { ...DEFAULT_PROFILE.household, kids: -1 } }).ok).toBe(false)
  })
  it('advise request needs a location and forecast', () => {
    expect(validateAdviseRequest({}).ok).toBe(false)
  })
  it('chat request rejects an empty question', () => {
    const r = validateChatRequest({
      location: { name: 'Delhi' }, aqiNow: { aqi: 300, pm25: 150 },
      forecast24: [{ time: '2026-11-19T07:00', aqi: 300, pm25: 150 }], profile: {}, question: '   ',
    })
    expect(r.ok).toBe(false)
  })
})

describe('swap ids', () => {
  it('rejects a swap without a known computed id', () => {
    expect(validateAdvice({ ...advice, swaps: [{ from: 'Car', to: 'Metro', impact_explained: 'x' }] }).ok).toBe(false)
  })
})
