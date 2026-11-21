// @ts-check
// AirWise AQI bands — CPCB-style band table and risk mapping.
// Binding contract: docs/CONTRACT.md §3.

export const AQI_BANDS = [
  { min: 0, max: 50, label: 'Good', color: '#16a34a', chip: 'bg-green-600' },
  { min: 51, max: 100, label: 'Satisfactory', color: '#65a30d', chip: 'bg-lime-600' },
  { min: 101, max: 200, label: 'Moderate', color: '#ca8a04', chip: 'bg-yellow-500' },
  { min: 201, max: 300, label: 'Poor', color: '#ea580c', chip: 'bg-orange-500' },
  { min: 301, max: 400, label: 'Very Poor', color: '#dc2626', chip: 'bg-red-600' },
  { min: 401, max: 500, label: 'Severe', color: '#991b1b', chip: 'bg-red-900' },
]

/** Return the band for an AQI value: { ...band, index }. Values > 500 clamp to Severe. */
/** @param {number | null | undefined} aqi */
export function bandForAqi(aqi) {
  const value = typeof aqi === 'number' && Number.isFinite(aqi) ? aqi : 0
  let index = AQI_BANDS.length - 1
  for (let i = 0; i < AQI_BANDS.length; i++) {
    if (value <= AQI_BANDS[i].max) {
      index = i
      break
    }
  }
  return { ...AQI_BANDS[index], index }
}

/** Risk level: 'low' (≤100) | 'moderate' (101–200) | 'high' (201–300) | 'severe' (>300). */
/**
 * @param {number | null | undefined} aqi
 * @returns {'low' | 'moderate' | 'high' | 'severe'}
 */
export function aqiToRisk(aqi) {
  const value = typeof aqi === 'number' && Number.isFinite(aqi) ? aqi : 0
  if (value <= 100) return 'low'
  if (value <= 200) return 'moderate'
  if (value <= 300) return 'high'
  return 'severe'
}

/**
 * CPCB National AQI breakpoints (µg/m³ → index). Source: CPCB National Air Quality Index (2014).
 * The top band is open-ended in CPCB; 380 (PM2.5) and 510 (PM10) cap the 401–500 range here.
 * @type {Record<'pm25' | 'pm10', [number, number, number, number][]>}  [concLo, concHi, idxLo, idxHi]
 */
export const CPCB_BREAKPOINTS = {
  pm25: [[0, 30, 0, 50], [30, 60, 51, 100], [60, 90, 101, 200], [90, 120, 201, 300], [120, 250, 301, 400], [250, 380, 401, 500]],
  pm10: [[0, 50, 0, 50], [50, 100, 51, 100], [100, 250, 101, 200], [250, 350, 201, 300], [350, 430, 301, 400], [430, 510, 401, 500]],
}

/**
 * CPCB sub-index for one pollutant by linear interpolation; null when the reading is missing.
 * @param {'pm25' | 'pm10'} pollutant
 * @param {number | null | undefined} conc
 * @returns {number | null}
 */
export function cpcbSubIndex(pollutant, conc) {
  if (typeof conc !== 'number' || !Number.isFinite(conc) || conc < 0) return null
  const table = CPCB_BREAKPOINTS[pollutant]
  for (const [cLo, cHi, iLo, iHi] of table) {
    if (conc <= cHi) return Math.round(iLo + ((iHi - iLo) * (conc - cLo)) / (cHi - cLo))
  }
  return 500
}

/**
 * Indian (CPCB) AQI = the worse of the PM2.5 and PM10 sub-indices. Open-Meteo gives hourly concentrations,
 * not CPCB's 24-hour averages, so this is an hourly estimate on the CPCB scale.
 * @param {number | null | undefined} pm25
 * @param {number | null | undefined} pm10
 * @returns {number | null}
 */
export function cpcbAqi(pm25, pm10) {
  const subs = [cpcbSubIndex('pm25', pm25), cpcbSubIndex('pm10', pm10)].filter((v) => v !== null)
  return subs.length ? Math.max(...subs) : null
}
