import { describe, it, expect } from 'vitest'
import { validateAdvice, validateProfile, validateProfileFields, validateAdviseRequest, validateChatRequest } from '../src/lib/validate.js'
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

describe('validateProfileFields (profile form)', () => {
  const hh = (/** @type {object} */ over) => ({ ...DEFAULT_PROFILE, household: { ...DEFAULT_PROFILE.household, ...over } })
  it('accepts the default profile', () => {
    expect(validateProfileFields(DEFAULT_PROFILE).ok).toBe(true)
  })
  it('maps bad counts and distance to their own fields with plain messages', () => {
    const r = validateProfileFields({ ...hh({ kids: -1, elderly: 1.5 }), commute: { ...DEFAULT_PROFILE.commute, distanceKm: Number.NaN }, home: { ...DEFAULT_PROFILE.home, plants: -2 } })
    expect(r).toEqual({ ok: false, errors: {
      kids: 'Enter a whole number, 0 or more',
      elderly: 'Enter a whole number, 0 or more',
      plants: 'Enter a whole number, 0 or more',
      distanceKm: 'Distance must be more than 0 km',
    } })
  })
  it('needs one household member and a commute distance unless working from home', () => {
    expect(validateProfileFields(hh({ adults: 0 }))).toEqual({ ok: false, errors: { adults: 'Add at least one household member' } })
    const zero = { ...DEFAULT_PROFILE, commute: { ...DEFAULT_PROFILE.commute, mode: 'car', distanceKm: 0 } }
    expect(validateProfileFields(zero)).toEqual({ ok: false, errors: { distanceKm: 'Distance must be more than 0 km' } })
    expect(validateProfileFields({ ...zero, commute: { ...zero.commute, mode: 'work_from_home' } }).ok).toBe(true)
  })
  it('collects problems not tied to a form field under form', () => {
    const r = validateProfileFields({ ...DEFAULT_PROFILE, language: 'fr', outdoor: { ...DEFAULT_PROFILE.outdoor, walkTime: '7am' } })
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.errors.form).toMatch(/^.+; .+$/)
  })
})
