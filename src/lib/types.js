// @ts-check
// Shared JSDoc types for AirWise. Profile is inferred from the zod schema, so the type and the validator can't drift.

/** @typedef {import('zod').infer<typeof import('./validate.js').ProfileSchema>} Profile */
/** @typedef {{ time: string, aqi: number | null, pm25: number | null, pm10?: number | null, no2?: number | null }} HourEntry */
/** @typedef {{ time?: string, aqi: number | null, pm25: number | null, pm10?: number | null, no2?: number | null, o3?: number | null, co?: number | null, so2?: number | null }} AqiNow */
/** @typedef {{ name: string, admin1?: string, country?: string, latitude?: number, longitude?: number }} Place */
/** @typedef {{ id: string, label: string, conc: number, minutes: number, rate: number, mult: number, ug: number }} ExposureItem */
/** @typedef {{ id: string, from: string, to: string, co2KgPerWeek: number, moneySavedPerMonth: number, exposureCutUgPerDay: number, why: string, applicable: boolean }} ComputedSwap */

export {}
