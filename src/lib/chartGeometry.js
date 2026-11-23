// @ts-check
// Pure geometry for the dependency-free SVG forecast chart (ForecastChart.jsx). Kept separate so it is type-checked
// and unit-tested without a DOM.

/** @typedef {{ time: string, pm25: number | null, aqi: number | null }} Point */

export const CHART = /** @type {const} */ ({ width: 800, height: 320, top: 24, right: 44, bottom: 28, left: 44 })

/**
 * Round a maximum up to a readable axis top (1, 2, 2.5, 5 × 10^n).
 * @param {number} max
 */
export function niceMax(max) {
  if (!(max > 0)) return 10
  const exp = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= max) ?? 10
  return step * exp
}

/**
 * SVG path through the non-null values; a null starts a new segment so gaps stay visible.
 * @param {(number | null)[]} values
 * @param {(i: number) => number} x
 * @param {(v: number) => number} y
 */
export function linePath(values, x, y) {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) { pen = false; return }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return d
}

/**
 * Closed area under each non-null segment, down to the baseline.
 * @param {(number | null)[]} values
 * @param {(i: number) => number} x
 * @param {(v: number) => number} y
 * @param {number} base
 */
export function areaPath(values, x, y, base) {
  /** @type {number[][]} */
  const segs = []
  /** @type {number[]} */
  let cur = []
  values.forEach((v, i) => {
    if (v == null) { if (cur.length) segs.push(cur); cur = []; return }
    cur.push(i)
  })
  if (cur.length) segs.push(cur)
  return segs
    .map((s) => {
      const top = s.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(/** @type {number} */ (values[i])).toFixed(1)}`).join('')
      return `${top}L${x(s[s.length - 1]).toFixed(1)},${base}L${x(s[0]).toFixed(1)},${base}Z`
    })
    .join('')
}

/**
 * Scales, paths and ticks for a list of hourly points.
 * @param {Point[]} points
 */
export function buildChart(points) {
  const { width, height, top, right, bottom, left } = CHART
  const plotW = width - left - right
  const plotH = height - top - bottom
  const base = top + plotH
  const n = Math.max(points.length - 1, 1)
  const pm = points.map((p) => p.pm25)
  const aqi = points.map((p) => p.aqi)
  const pmMax = niceMax(Math.max(15, ...pm.map((v) => v ?? 0)))
  const aqiMax = niceMax(Math.max(...aqi.map((v) => v ?? 0)))
  const x = (/** @type {number} */ i) => left + (i / n) * plotW
  const yPm = (/** @type {number} */ v) => base - (v / pmMax) * plotH
  const yAqi = (/** @type {number} */ v) => base - (v / aqiMax) * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return {
    x, yPm, yAqi, base, plotW, plotH,
    pmLine: linePath(pm, x, yPm),
    pmArea: areaPath(pm, x, yPm, base),
    aqiLine: linePath(aqi, x, yAqi),
    pmTicks: ticks.map((t) => ({ y: base - t * plotH, label: String(Math.round(t * pmMax)) })),
    aqiTicks: ticks.map((t) => ({ y: base - t * plotH, label: String(Math.round(t * aqiMax)) })),
    whoY: yPm(15),
    /** Index of the point nearest a horizontal pixel position in viewBox units. */
    indexAt: (/** @type {number} */ px) => Math.min(points.length - 1, Math.max(0, Math.round(((px - left) / plotW) * n))),
  }
}
