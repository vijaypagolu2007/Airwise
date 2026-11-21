// Synthetic 24-hour forecast for tests: pm25 80 at 07:00, 40 at 15:00, 60 elsewhere.
export function makeHourly(overrides = {}) {
  return Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, '0')
    const pm25 = overrides[h] ?? (h === 7 ? 80 : h === 15 ? 40 : 60)
    return { time: `2026-11-19T${hh}:00`, aqi: Math.round(pm25 * 2.5), pm25, pm10: pm25 * 1.5, no2: 30 }
  })
}
