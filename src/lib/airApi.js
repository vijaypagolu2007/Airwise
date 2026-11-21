// @ts-check
// AirWise air-quality client — Open-Meteo Air Quality API (free, no key).
// Binding contract: docs/CONTRACT.md §2. AQI is the Indian CPCB index computed from PM2.5/PM10 (aqiBands.js).
import { cpcbAqi } from './aqiBands.js'

/** @typedef {import('./types.js').HourEntry} HourEntry */

/** @param {unknown} n @returns {number | null} */
const r1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null)

/**
 * Fetch current + 48h hourly air quality for a coordinate.
 * @param {number} lat
 * @param {number} lon
 * @throws {Error} 'AIR_API_FAILED'
 */
export async function fetchAirQuality(lat, lon) {
  const url =
    'https://air-quality-api.open-meteo.com/v1/air-quality' +
    `?latitude=${lat}&longitude=${lon}` +
    '&current=pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide' +
    '&hourly=pm2_5,pm10,nitrogen_dioxide&timezone=auto&forecast_days=2'

  let json
  try {
    const res = await fetch(url)
    if (!res || !res.ok) throw new Error('bad status')
    json = await res.json()
  } catch {
    throw new Error('AIR_API_FAILED')
  }
  if (!json || !json.current || !json.hourly || !Array.isArray(json.hourly.time)) {
    throw new Error('AIR_API_FAILED')
  }

  const c = json.current
  const h = json.hourly
  /** @type {HourEntry[]} */
  const hourly = h.time.slice(0, 48).map((/** @type {string} */ time, /** @type {number} */ i) => {
    const pm25 = r1(h.pm2_5?.[i])
    const pm10 = r1(h.pm10?.[i])
    return { time, aqi: cpcbAqi(pm25, pm10), pm25, pm10, no2: r1(h.nitrogen_dioxide?.[i]) }
  })
  const pm25Now = r1(c.pm2_5)
  const pm10Now = r1(c.pm10)

  return {
    location: {
      latitude: json.latitude,
      longitude: json.longitude,
      timezone: json.timezone,
      utcOffsetSeconds: json.utc_offset_seconds,
    },
    current: {
      time: c.time,
      aqi: cpcbAqi(pm25Now, pm10Now),
      pm25: pm25Now,
      pm10: pm10Now,
      no2: r1(c.nitrogen_dioxide),
      o3: r1(c.ozone),
      co: r1(c.carbon_monoxide),
      so2: r1(c.sulphur_dioxide),
    },
    hourly,
  }
}

/** @param {{ time: string }} entry */
const hourOf = (entry) => parseInt(String(entry.time).split('T')[1]?.slice(0, 2) ?? '0', 10)

/** Entry at "HH:MM" within the first 24 entries; closest hour if no exact match (tie → later). */
/**
 * @param {HourEntry[] | null | undefined} hourly
 * @param {string} hhmm
 * @returns {HourEntry | null}
 */
export function pm25AtHour(hourly, hhmm) {
  const day = (hourly || []).slice(0, 24)
  if (day.length === 0) return null
  const exact = day.find((e) => String(e.time).endsWith(`T${hhmm}`))
  if (exact) return exact
  const target = parseInt(String(hhmm).slice(0, 2), 10) || 0
  let best = day[0]
  let bestDiff = Infinity
  for (const e of day) {
    const d = Math.abs(hourOf(e) - target)
    if (d < bestDiff || (d === bestDiff && hourOf(e) > hourOf(best))) {
      best = e
      bestDiff = d
    }
  }
  return best
}

/**
 * @param {HourEntry[] | null | undefined} hourly @param {number} startHour @param {number} endHour
 * @param {(a: number, b: number) => boolean} cmp
 * @returns {HourEntry | null}
 */
function pickHour(hourly, startHour, endHour, cmp) {
  const day = (hourly || [])
    .slice(0, 24)
    .filter((e) => typeof e.pm25 === 'number' && hourOf(e) >= startHour && hourOf(e) <= endHour)
  let pick = null
  for (const e of day) if (!pick || cmp(e.pm25 ?? 0, pick.pm25 ?? 0)) pick = e
  return pick
}

/** Lowest-PM2.5 entry in [startHour, endHour] of the first 24 entries; tie → earliest. */
/** @param {HourEntry[] | null | undefined} hourly */
export function bestHour(hourly, startHour = 6, endHour = 21) {
  return pickHour(hourly, startHour, endHour, (a, b) => a < b)
}

/** Highest-PM2.5 entry in [startHour, endHour] of the first 24 entries; tie → earliest. */
/** @param {HourEntry[] | null | undefined} hourly */
export function worstHour(hourly, startHour = 6, endHour = 21) {
  return pickHour(hourly, startHour, endHour, (a, b) => a > b)
}
