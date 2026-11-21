// @ts-check
// AirWise impact engine — deterministic, pure functions. Every number shown in the UI
// comes from here; Gemini only explains these numbers. Binding contract: docs/CONTRACT.md §5.
//
// Constants and sources of the assumptions
//   RATE_LPM       resting breathing rate in litres/min by group (adult 12, child 10, elderly 11,
//                  pregnant 12.5) — typical minute-ventilation values (US EPA Exposure Factors).
//   MULT           activity multiplier on breathing rate (rest 1, commute 1.4, walk 3, cycle 3.5,
//                  sports 5).
//   MIN_PER_KM     minutes per km by mode (urban Indian traffic averages).
//   OUTDOOR_FACTOR share of outside air reaching the person per mode (closed car 0.6, metro 0.5).
//   INDOOR_RATIO   indoor PM2.5 ≈ 60% of outdoor (infiltration) + cooking plume.
//   COOK_PM        extra indoor PM2.5 (µg/m³) during cooking by fuel.
//   CO2_G_PER_KM   per-passenger CO₂ (g/km) by mode.
//   COST_PER_KM    ₹ per km per person by mode.
//   Trips: 2 per day, 5 workdays per week, 4 weeks per month.
//   Inhaled dose (µg) = concentration (µg/m³) × minutes × litres/min × multiplier / 1000.

import { pm25AtHour, bestHour } from './airApi.js'

export const RATE_LPM = { adult: 12, child: 10, elderly: 11, pregnant: 12.5 }
export const MULT = { rest: 1, commute: 1.4, walk: 3, cycle: 3.5, sports: 5 }
/** @type {Record<string, number>} */
export const MIN_PER_KM = { walk: 12, cycle: 3.5, bike: 3, car: 2.5, auto: 3, bus: 2.2, metro: 2, work_from_home: 0 }
/** @type {Record<string, number>} */
export const OUTDOOR_FACTOR = { walk: 1, cycle: 1, bike: 1, car: 0.6, auto: 0.8, bus: 1, metro: 0.5, work_from_home: 0 }
export const INDOOR_RATIO = 0.6
/** @type {Record<string, number>} */
export const COOK_PM = { induction: 15, lpg: 40, kerosene: 90, wood: 250, coal: 280 }
/** @type {Record<string, number>} */
export const CO2_G_PER_KM = { walk: 0, cycle: 0, metro: 14, bus: 60, bike: 85, auto: 105, car: 171, work_from_home: 0 }
/** @type {Record<string, number>} */
export const COST_PER_KM = { walk: 0, cycle: 0, metro: 3, bus: 4, bike: 3.5, auto: 9, car: 12, work_from_home: 0 }
export const TRIPS_PER_DAY = 2
export const WORKDAYS_PER_WEEK = 5
export const WEEKS_PER_MONTH = 4

/** @typedef {import('./types.js').Profile} Profile */
/** @typedef {import('./types.js').HourEntry} HourEntry */
/** @typedef {import('./types.js').ExposureItem} ExposureItem */

/** @param {unknown} x */
const r1 = (x) => Math.round((Number(x) || 0) * 10) / 10
/** @param {unknown} x */
const pos = (x) => Math.max(0, r1(x))

/** @param {number} conc @param {number} minutes @param {number} rateLpm @param {number} [mult] */
export function exposureUg(conc, minutes, rateLpm, mult = 1) {
  return r1((conc * minutes * rateLpm * mult) / 1000)
}

/** Weighted mean breathing rate of the household (litres/min). A pregnant member counts as an adult at 12.5. */
/** @param {any} profile a Profile or just its household block */
export function householdRate(profile) {
  const h = profile?.household || profile || {}
  const adults = Number(h.adults) || 0
  const kids = Number(h.kids) || 0
  const elderly = Number(h.elderly) || 0
  const count = adults + kids + elderly
  if (count <= 0) return h.pregnant ? RATE_LPM.pregnant : RATE_LPM.adult
  let sum = adults * RATE_LPM.adult + kids * RATE_LPM.child + elderly * RATE_LPM.elderly
  if (h.pregnant && adults > 0) sum += RATE_LPM.pregnant - RATE_LPM.adult
  return r1(sum / count)
}

/** @param {number} outdoorPm25 @param {string} fuel */
export function indoorConc(outdoorPm25, fuel) {
  return r1(outdoorPm25 * INDOOR_RATIO + (COOK_PM[fuel] ?? COOK_PM.lpg))
}

/** @param {string} mode @param {number} distanceKm */
export function commuteMinutes(mode, distanceKm) {
  return Math.round((Number(distanceKm) || 0) * (MIN_PER_KM[mode] ?? 0))
}

/** @param {HourEntry[]} hourly */
export function avgPm25(hourly) {
  const day = (hourly || []).slice(0, 24).filter((e) => typeof e.pm25 === 'number')
  if (day.length === 0) return 0
  return r1(day.reduce((s, e) => s + (e.pm25 ?? 0), 0) / day.length)
}

/** @param {HourEntry[]} hourly @param {string} hhmm */
const concAt = (hourly, hhmm) => pm25AtHour(hourly, hhmm)?.pm25 ?? 0

/**
 * @param {string} id @param {string} label @param {number} conc @param {number} minutes @param {number} rate @param {number} mult
 * @returns {ExposureItem}
 */
function item(id, label, conc, minutes, rate, mult) {
  return { id, label, conc: r1(conc), minutes, rate, mult: r1(mult), ug: exposureUg(conc, minutes, rate, mult) }
}

/** @param {HourEntry[]} hourly @param {string} time @param {number} rate */
function walkItem(hourly, time, rate) {
  return item('walk', `Walk at ${time}`, concAt(hourly, time), 45, rate, MULT.walk)
}
/** @param {Profile} profile @param {HourEntry[]} hourly @param {string} mode @param {number} rate */
function commuteItem(profile, hourly, mode, rate) {
  const c = profile.commute
  const minutes = commuteMinutes(mode, c.distanceKm) * TRIPS_PER_DAY
  return item('commute', `Commute by ${mode.replaceAll('_', ' ')}`, concAt(hourly, c.time), minutes, rate, MULT.commute * (OUTDOOR_FACTOR[mode] ?? 1))
}
/** @param {HourEntry[]} hourly @param {string} fuel @param {number} rate @param {number} [factor] */
function cookingItem(hourly, fuel, rate, factor = 1) {
  return item('cooking', `Cooking on ${fuel}`, indoorConc(avgPm25(hourly), fuel) * factor, 60, rate, MULT.rest)
}
/** @param {HourEntry[]} hourly @param {string} fuel @param {number} rate @param {number} [factor] */
function homeIndoorItem(hourly, fuel, rate, factor = 1) {
  return item('homeIndoor', '12 h indoors at home', indoorConc(avgPm25(hourly), fuel) * factor, 720, rate, 1)
}

/** The un-optimised "before" day. */
/** @param {Profile} profile @param {HourEntry[]} hourly @returns {ExposureItem[]} */
export function activityExposure(profile, hourly) {
  const rate = householdRate(profile)
  const o = profile.outdoor || {}
  const out = []
  if (o.walk) out.push(walkItem(hourly, o.walkTime, rate))
  out.push(commuteItem(profile, hourly, profile.commute.mode, rate))
  if ((profile.household?.kids || 0) > 0 && o.schoolRun) {
    out.push(item('schoolRun', `School run at ${o.schoolRunTime}`, concAt(hourly, o.schoolRunTime), 30, rate, MULT.walk))
  }
  if (o.sports) out.push(item('sports', `Sports at ${o.sportsTime}`, concAt(hourly, o.sportsTime), 60, rate, MULT.sports))
  out.push(cookingItem(hourly, profile.home.fuel, rate))
  return out
}

/**
 * @param {Profile} profile @param {HourEntry[]} hourly
 * @returns {import('./types.js').ComputedSwap[]}
 */
export function computeAllSwaps(profile, hourly) {
  const rate = householdRate(profile)
  const o = profile.outdoor || {}
  const { mode, distanceKm } = profile.commute
  const fuel = profile.home.fuel
  const avg = avgPm25(hourly)
  const best = bestHour(hourly)
  const bestTime = best ? best.time.slice(11, 16) : o.walkTime
  const weeklyKm = distanceKm * TRIPS_PER_DAY * WORKDAYS_PER_WEEK

  const walkCut = pos(walkItem(hourly, o.walkTime, rate).ug - walkItem(hourly, bestTime, rate).ug)
  const metroCut = pos(commuteItem(profile, hourly, mode, rate).ug - commuteItem(profile, hourly, 'metro', rate).ug)
  const fuelCut = pos(cookingItem(hourly, fuel, rate).ug - cookingItem(hourly, 'lpg', rate).ug)
  const purifierCut = pos((indoorConc(avg, fuel) * 0.4 * 720 * rate) / 1000)
  const solid = ['wood', 'coal', 'kerosene'].includes(fuel)

  return [
    {
      id: 'walkShift',
      from: `Morning walk at ${o.walkTime}`,
      to: `Walk at ${bestTime}`,
      co2KgPerWeek: 0,
      moneySavedPerMonth: 0,
      exposureCutUgPerDay: walkCut,
      why: `You inhale ~3× more air during a brisk walk, so shifting it to the cleanest hour cuts your daily PM2.5 dose by ${walkCut} µg.`,
      applicable: !!o.walk,
    },
    {
      id: 'carToMetro',
      from: `${mode.replaceAll('_', ' ')} commute (${distanceKm} km)`,
      to: 'Metro / public transport',
      co2KgPerWeek: pos((weeklyKm * ((CO2_G_PER_KM[mode] ?? 0) - CO2_G_PER_KM.metro)) / 1000),
      moneySavedPerMonth: pos(weeklyKm * WEEKS_PER_MONTH * ((COST_PER_KM[mode] ?? 0) - COST_PER_KM.metro)),
      exposureCutUgPerDay: metroCut,
      why: `One metro trip replaces a private vehicle trip: per person CO₂ drops from ${CO2_G_PER_KM[mode] ?? 0} g/km to ~14 g/km.`,
      applicable: ['car', 'auto', 'bike'].includes(mode),
    },
    {
      id: 'fuelSwap',
      from: `${fuel} cooking`,
      to: 'LPG / induction cooking',
      co2KgPerWeek: fuel === 'wood' || fuel === 'coal' ? 22 : fuel === 'kerosene' ? 15 : 0,
      moneySavedPerMonth: solid ? 400 : 0,
      exposureCutUgPerDay: fuelCut,
      why: 'Solid-fuel cooking can push indoor PM2.5 past 300 µg/m³ — switching fuel removes most of that plume.',
      applicable: solid,
    },
    {
      id: 'purifier',
      from: 'No air purifier',
      to: 'Air purifier or DIY Corsi-Rosenthal box fan filter',
      co2KgPerWeek: 0,
      moneySavedPerMonth: 0,
      exposureCutUgPerDay: purifierCut,
      why: 'A box-fan + MERV-13 filter removes ~60% of indoor PM2.5 for under ₹2,000.',
      applicable: !profile.home.purifier,
    },
    {
      id: 'wasteToCompost',
      from: 'Open waste burning in the neighbourhood',
      to: 'Composting + segregated waste pickup',
      co2KgPerWeek: 8,
      moneySavedPerMonth: 0,
      exposureCutUgPerDay: 30,
      why: 'Burning trash releases PM2.5 and dioxins next to homes; segregating and composting removes that source.',
      applicable: true,
    },
  ]
}

/** @param {ExposureItem[]} items */
const total = (items) => r1(items.reduce((s, i) => s + i.ug, 0))

/** Before vs after the applied swaps. Home-indoor time is always counted (12 h). */
/** @param {Profile} profile @param {HourEntry[]} hourly @param {string[]} [appliedSwapIds] */
export function computeExposureSummary(profile, hourly, appliedSwapIds = []) {
  const rate = householdRate(profile)
  const applied = new Set(appliedSwapIds)
  const o = profile.outdoor || {}
  const fuel = profile.home.fuel
  const hasPurifier = !!profile.home.purifier
  const purifierOn = hasPurifier || applied.has('purifier')

  const beforeFactor = hasPurifier ? 0.6 : 1
  const before = [...activityExposure(profile, hourly)].map((i) =>
    i.id === 'cooking' ? cookingItem(hourly, fuel, rate, beforeFactor) : i,
  )
  before.push(homeIndoorItem(hourly, fuel, rate, beforeFactor))

  const best = bestHour(hourly)
  const afterFuel = applied.has('fuelSwap') && ['wood', 'coal', 'kerosene'].includes(fuel) ? 'lpg' : fuel
  const afterFactor = purifierOn ? 0.6 : 1
  const after = before.map((i) => {
    if (i.id === 'walk' && applied.has('walkShift') && o.walk && best) return walkItem(hourly, best.time.slice(11, 16), rate)
    if (i.id === 'commute' && applied.has('carToMetro') && ['car', 'auto', 'bike'].includes(profile.commute.mode))
      return commuteItem(profile, hourly, 'metro', rate)
    if (i.id === 'cooking') return cookingItem(hourly, afterFuel, rate, afterFactor)
    if (i.id === 'homeIndoor') return homeIndoorItem(hourly, afterFuel, rate, afterFactor)
    return i
  })

  const beforeTotal = total(before)
  const afterTotal = total(after)
  const cutUg = pos(beforeTotal - afterTotal)
  return {
    before: { totalUg: beforeTotal, byActivity: before },
    after: { totalUg: afterTotal, byActivity: after },
    cutUg,
    cutPercent: beforeTotal > 0 ? Math.round((cutUg / beforeTotal) * 100) : 0,
  }
}

/** @param {number} n */
export function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
