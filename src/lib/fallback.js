// @ts-check
// AirWise rule-based advice — same shape as the Gemini output (AdviceSchema).
// Used when Gemini is unavailable (no key, quota, bad JSON) so the app never breaks.
// Binding contract: docs/CONTRACT.md §8.

import { aqiToRisk, bandForAqi } from './aqiBands.js'
import { bestHour, pm25AtHour } from './airApi.js'
import { computeAllSwaps, formatNumber } from './impact.js'

/** @param {{ time?: string } | null | undefined} entry @param {string} dflt */
const hhmmOf = (entry, dflt) => (entry?.time ? entry.time.slice(11, 16) : dflt)

/** @param {string} name @param {number} aqi @param {number} pm25 */
function summaryFor(name, aqi, pm25) {
  const band = bandForAqi(aqi).label
  const pm = pm25 > 100 ? ` PM2.5 is ${pm25} µg/m³, well above the WHO 24-h guideline of 15.` : ''
  /** @type {Record<string, string>} */
  const lines = {
    Good: `Air in ${name} is Good (AQI ${aqi}). A great day to be outdoors and air out your home.`,
    Satisfactory: `Air in ${name} is Satisfactory (AQI ${aqi}). Normal routines are fine; sensitive members should avoid traffic peaks.`,
    Moderate: `Air in ${name} is Moderate (AQI ${aqi}). Shift exercise to cleaner hours and limit time near heavy traffic.`,
    Poor: `Air in ${name} is Poor (AQI ${aqi}). Cut outdoor exertion, use masks outside and keep indoor air filtered.`,
    'Very Poor': `Air in ${name} is Very Poor (AQI ${aqi}). Avoid outdoor exercise and keep windows closed most of the day.`,
    Severe: `Air in ${name} is Severe (AQI ${aqi}). Minimise outdoor exertion today and keep indoor air as clean as possible.`,
  }
  return lines[band] + pm
}

/**
 * @param {{ location?: { name?: string }, aqiNow?: { aqi: number | null, pm25: number | null }, forecast24?: import('./types.js').HourEntry[], profile: import('./types.js').Profile, computedImpacts?: { swaps?: import('./types.js').ComputedSwap[] } }} input
 */
export function fallbackAdvice({ location, aqiNow, forecast24, profile, computedImpacts }) {
  const name = location?.name || 'your city'
  const aqi = Math.round(aqiNow?.aqi ?? 0)
  const pm25 = aqiNow?.pm25 ?? 0
  const hourly = forecast24 || []
  const h = profile?.household || {}
  const o = profile?.outdoor || {}
  const c = profile?.commute || {}
  const fuel = profile?.home?.fuel || 'lpg'
  const best = bestHour(hourly)
  const bestTime = hhmmOf(best, '15:00')
  const swapsAll = computedImpacts?.swaps || computeAllSwaps(profile, hourly)

  const routine = []

  if (aqi <= 100) {
    routine.push({ time: '07:00', activity: 'Open windows in the morning for fresh air', reason: `AQI ${aqi} is low, so airing out flushes indoor pollutants.` })
  } else if (aqi <= 300) {
    routine.push({ time: bestTime, activity: 'Ventilate during the cleanest window', reason: `PM2.5 is lowest around ${bestTime} (${best?.pm25 ?? '–'} µg/m³) — ventilate for 15–20 minutes then.` })
  } else {
    routine.push({ time: bestTime, activity: 'Keep windows closed; brief ventilation only in the cleanest hour', reason: `AQI ${aqi} outdoors — even the cleanest hour (${bestTime}) is unhealthy, so keep airing short.` })
  }

  if (o.walk) {
    const t = aqi > 100 ? bestTime : o.walkTime
    const pm = pm25AtHour(hourly, t)?.pm25 ?? pm25
    routine.push({ time: t, activity: aqi > 100 ? `Move your walk from ${o.walkTime} to ${t}` : 'Morning walk', reason: `PM2.5 at ${t} is about ${pm} µg/m³${aqi > 100 ? ', the cleanest daytime hour' : ''}.` })
  }

  if ((h.kids || 0) > 0 && o.schoolRun) {
    routine.push({ time: o.schoolRunTime, activity: `School run${aqi > 200 ? ' with N95 mask for the child' : ''}`, reason: `AQI ${aqi} at drop-off time; children breathe faster for their size.` })
  }

  if (['car', 'auto', 'bike'].includes(c.mode)) {
    if (aqi > 200) {
      const s = swapsAll.find((x) => x.id === 'carToMetro')
      const reason = s
        ? `Saves ${s.co2KgPerWeek} kg CO₂ a week and ₹${formatNumber(s.moneySavedPerMonth)} a month, and cuts your commute dose by ${s.exposureCutUgPerDay} µg.`
        : 'Public transport cuts both emissions and your exposure inside traffic.'
      routine.push({ time: c.time, activity: 'Take metro/bus today', reason })
    } else {
      routine.push({ time: c.time, activity: `Commute by ${c.mode}, windows up and recirculation on`, reason: `AQI ${aqi}; recirculation keeps roadside exhaust out.` })
    }
  } else if (c.mode && c.mode !== 'work_from_home') {
    routine.push({ time: c.time, activity: `Commute by ${c.mode}${aqi > 200 ? ' with an N95 mask' : ''}`, reason: `AQI ${aqi} along the way; a well-fitted N95 filters ~95% of PM2.5.` })
  }

  if (o.sports) {
    const evening = bestHour(hourly, 16, 21)
    const t = hhmmOf(evening, o.sportsTime)
    routine.push({ time: t, activity: aqi > 300 ? 'Indoor workout instead of outdoor sports' : 'Sports in the cleanest evening hour', reason: `PM2.5 around ${t} is ${evening?.pm25 ?? '–'} µg/m³; heavy exercise multiplies how much you inhale ~5×.` })
  }

  if (['wood', 'coal', 'kerosene'].includes(fuel)) {
    routine.push({ time: '18:00', activity: 'Cook on LPG/induction today, exhaust on', reason: `${fuel} smoke can push indoor PM2.5 past 300 µg/m³.` })
  }

  if (aqi > 150) {
    routine.push({ time: '20:00', activity: 'Wet-mop floors in the evening', reason: 'Settled dust gets kicked back into the air; wet mopping traps it.' })
  }

  routine.sort((a, b) => a.time.localeCompare(b.time))

  /** @type {import('./types.js').IndoorHack[]} */
  const hacks = []
  const vulnerable = h.asthma || h.copd || h.heart || h.pregnant || (h.elderly || 0) > 0 || (h.kids || 0) > 0
  /** @type {import('./types.js').IndoorHack} */
  const traffic = { tip: 'Close windows during traffic peaks 8–10 & 17–20', why: 'Rush-hour exhaust drifts indoors through open windows (infiltration).', effort: 'low' }
  if (vulnerable) hacks.push(traffic)
  if (!profile?.home?.purifier) hacks.push({ tip: 'Build a Corsi-Rosenthal box fan filter', why: 'Four MERV-13 filters taped to a box fan pull PM2.5 out of room air for under ₹2,000.', effort: 'med' })
  hacks.push({ tip: 'Seal gaps around doors and windows', why: 'Draught strips cut the outdoor air that leaks in when smog is heavy.', effort: 'low' })
  hacks.push({ tip: 'Wet-mop and damp-dust daily', why: 'Dry sweeping resuspends fine particles; damp cloths trap them.', effort: 'low' })
  hacks.push({ tip: 'Run the kitchen exhaust while cooking and 10 min after', why: 'Cooking creates a dense particle plume; extraction removes it at the source.', effort: 'low' })
  if (['wood', 'coal', 'kerosene'].includes(fuel)) hacks.push({ tip: 'Switch to LPG or induction', why: 'Solid fuels are the largest indoor PM2.5 source in many homes.', effort: 'high' })
  if ((profile?.home?.plants || 0) > 0) hacks.push({ tip: "Don't rely on plants to clean the air", why: 'You would need hundreds of plants per room to match one filter; keep them for wellbeing.', effort: 'low' })
  if (profile?.home?.purifier) hacks.push({ tip: 'Clean or replace purifier filters on schedule', why: 'A clogged filter moves far less air and stops removing particles.', effort: 'low' })
  if (!vulnerable) hacks.push(traffic)

  const swaps = swapsAll
    .filter((s) => s.applicable)
    .slice(0, 6)
    .map((s) => ({
      id: s.id,
      from: s.from,
      to: s.to,
      impact_explained: computedImpacts
        ? `Cuts your daily PM2.5 dose by ${s.exposureCutUgPerDay} µg${s.co2KgPerWeek ? `, saves ${s.co2KgPerWeek} kg CO₂ a week` : ''}${s.moneySavedPerMonth ? ` and ₹${formatNumber(s.moneySavedPerMonth)} a month` : ''}.`
        : s.why,
    }))

  return {
    summary: summaryFor(name, aqi, pm25),
    risk_level: aqiToRisk(aqi),
    routine: routine.slice(0, 12),
    indoor_hacks: hacks.slice(0, 7),
    swaps,
  }
}
