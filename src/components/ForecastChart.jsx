import { useEffect, useMemo, useRef, useState } from 'react'
import { bestHour, worstHour } from '../lib/airApi.js'
import { CHART, buildChart } from '../lib/chartGeometry.js'

// Hand-drawn SVG instead of a chart library: one chart does not justify a 400 kB dependency.
/** @param {import('../lib/types.js').HourEntry} e */
const lbl = (e) => `${e.time.slice(8, 10)}/${e.time.slice(11, 13)}h`
const PM = '#0284c7'
const AQI = '#b45309'

/**
 * @param {{ hourly: import('../lib/types.js').HourEntry[] }} props
 */
export default function ForecastChart({ hourly }) {
  const { g, best, worst } = useMemo(() => {
    const g = buildChart(hourly)
    /** @param {import('../lib/types.js').HourEntry | null | undefined} e */
    const idx = (e) => (e ? hourly.indexOf(e) : -1)
    return { g, best: idx(bestHour(hourly)), worst: idx(worstHour(hourly)) }
  }, [hourly])
  const [hover, setHover] = useState(-1)
  // Read layout once per pointer entry, not on every move.
  const box = useRef(/** @type {DOMRect | null} */ (null))

  // A resize or scroll while hovering moves the chart, so drop the cached box and re-read on the next move.
  useEffect(() => {
    const reset = () => { box.current = null }
    window.addEventListener('resize', reset)
    window.addEventListener('scroll', reset, true)
    return () => {
      window.removeEventListener('resize', reset)
      window.removeEventListener('scroll', reset, true)
    }
  }, [])

  /** @param {import('react').PointerEvent<SVGSVGElement>} e */
  const onEnter = (e) => {
    box.current = e.currentTarget.getBoundingClientRect()
  }
  /** @param {import('react').PointerEvent<SVGSVGElement>} e */
  const onMove = (e) => {
    const r = box.current ?? e.currentTarget.getBoundingClientRect()
    box.current = r
    if (!r.width) return
    setHover(g.indexAt(((e.clientX - r.left) / r.width) * CHART.width))
  }
  const onLeave = () => {
    box.current = null
    setHover(-1)
  }
  /** Arrow keys scrub hour by hour; Home/End jump to the ends; Escape clears.
   * @param {import('react').KeyboardEvent<HTMLDivElement>} e */
  const onKey = (e) => {
    const last = hourly.length - 1
    /** @type {Record<string, number>} */
    const next = {
      ArrowRight: Math.min(last, hover < 0 ? best : hover + 1),
      ArrowLeft: Math.max(0, hover < 0 ? best : hover - 1),
      Home: 0,
      End: last,
      Escape: -1,
    }
    if (!(e.key in next) || last < 0) return
    e.preventDefault()
    setHover(next[e.key])
  }
  const h = hover >= 0 ? hourly[hover] : null
  const b = hourly[best]
  const w = hourly[worst]

  return (
    <figure className="w-full">
      {/* Container matches the viewBox ratio so text and markers never stretch. */}
      <div
        className="aspect-[5/2] w-full rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        tabIndex={0}
        role="group"
        aria-label="Forecast chart. Use left and right arrow keys to read each hour."
        onKeyDown={onKey}
        onBlur={() => setHover(-1)}
      >
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={`48-hour forecast. Cleanest hour ${b?.time.slice(11, 16)} at ${b?.pm25} µg/m³, worst ${w?.time.slice(11, 16)} at ${w?.pm25} µg/m³.`}
          onPointerEnter={onEnter}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          <defs>
            <linearGradient id="pmFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PM} stopOpacity="0.3" />
              <stop offset="100%" stopColor={PM} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <g fontSize="11" fill="#475569">
            {g.pmTicks.map((t, i) => (
              <g key={i}>
                <line x1={CHART.left} x2={CHART.width - CHART.right} y1={t.y} y2={t.y} stroke="#d6e9f5" strokeDasharray="3 3" />
                <text x={CHART.left - 6} y={t.y + 4} textAnchor="end">{t.label}</text>
                <text x={CHART.width - CHART.right + 6} y={t.y + 4}>{g.aqiTicks[i].label}</text>
              </g>
            ))}
            {hourly.map((e, i) => (i % 6 === 0 ? <text key={e.time} x={g.x(i)} y={CHART.height - 8} textAnchor="middle">{lbl(e)}</text> : null))}
          </g>
          <line x1={CHART.left} x2={CHART.width - CHART.right} y1={g.whoY} y2={g.whoY} stroke="#16a34a" strokeDasharray="2 4" />
          <text x={CHART.left + 4} y={g.whoY - 4} fontSize="10" fill="#15803d">WHO 15</text>
          <path d={g.pmArea} fill="url(#pmFill)" />
          <path d={g.pmLine} fill="none" stroke={PM} strokeWidth="2.5" />
          <path d={g.aqiLine} fill="none" stroke={AQI} strokeWidth="2" strokeDasharray="6 4" />
          {/** @type {[import('../lib/types.js').HourEntry | undefined, number, string, string][]} */ ([[b, best, '#16a34a', 'Cleanest'], [w, worst, '#dc2626', 'Worst']]).map(([e, i, color, text]) =>
            e && e.pm25 != null ? (
              <g key={text}>
                <circle cx={g.x(i)} cy={g.yPm(e.pm25)} r="7" fill={color} stroke="white" strokeWidth="2" />
                <text x={g.x(i)} y={g.yPm(e.pm25) - 12} fontSize="11" textAnchor="middle" fill="#0f172a">{text}</text>
              </g>
            ) : null,
          )}
          {h && (
            <g pointerEvents="none">
              <line x1={g.x(hover)} x2={g.x(hover)} y1={CHART.top} y2={g.base} stroke="#94a3b8" />
              {h.pm25 != null && <circle cx={g.x(hover)} cy={g.yPm(h.pm25)} r="4" fill={PM} />}
            </g>
          )}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-sky-600" aria-hidden="true" />PM2.5 (µg/m³, left)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-amber-700" aria-hidden="true" />AQI (dashed, right)</span>
        <span aria-live="polite" className="ml-auto tabular-nums">
          {h ? `${h.time.replace('T', ' ')} · PM2.5 ${h.pm25 ?? '–'} · AQI ${h.aqi ?? '–'}` : ''}
        </span>
      </figcaption>
    </figure>
  )
}

/** @param {{ hourly: import('../lib/types.js').HourEntry[] }} props */
export function ForecastTable({ hourly }) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Hourly forecast</caption>
        <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
          <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">PM2.5 µg/m³</th><th className="px-3 py-2">AQI</th></tr>
        </thead>
        <tbody>
          {hourly.map((e) => (
            <tr key={e.time} className="border-t border-border">
              <td className="px-3 py-1.5">{e.time.replace('T', ' ')}</td>
              <td className="px-3 py-1.5">{e.pm25 ?? '–'}</td>
              <td className="px-3 py-1.5">{e.aqi ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
