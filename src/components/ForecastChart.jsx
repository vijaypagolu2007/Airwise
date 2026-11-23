import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceDot, ReferenceLine } from 'recharts'
import { bestHour, worstHour } from '../lib/airApi.js'

const lbl = (e) => (e ? `${e.time.slice(8, 10)}/${e.time.slice(11, 13)}h` : null)

export default function ForecastChart({ hourly, height = 'h-80' }) {
  const { data, best, worst } = useMemo(
    () => ({ data: hourly.map((e) => ({ ...e, label: lbl(e) })), best: bestHour(hourly), worst: worstHour(hourly) }),
    [hourly],
  )
  return (
    <div className={`${height} w-full`} role="img" aria-label={`48-hour forecast. Cleanest hour ${best?.time.slice(11, 16)} at ${best?.pm25} µg/m³, worst ${worst?.time.slice(11, 16)} at ${worst?.pm25} µg/m³.`}>
      <ResponsiveContainer initialDimension={{ width: 800, height: 320 }}>
        <ComposedChart data={data} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="pmFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0284c7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6e9f5" />
          <XAxis dataKey="label" interval={5} tick={{ fontSize: 11, fill: '#475569' }} />
          <YAxis yAxisId="pm" tick={{ fontSize: 11, fill: '#475569' }} />
          <YAxis yAxisId="aqi" orientation="right" tick={{ fontSize: 11, fill: '#475569' }} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #d6e9f5' }} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <ReferenceLine yAxisId="pm" y={15} stroke="#16a34a" strokeDasharray="2 4" label={{ value: 'WHO 15', fontSize: 10, fill: '#15803d', position: 'insideTopLeft' }} />
          <Area yAxisId="pm" type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke="#0284c7" strokeWidth={2.5} fill="url(#pmFill)" isAnimationActive={false} />
          <Line yAxisId="aqi" type="monotone" dataKey="aqi" name="AQI (dashed)" stroke="#d97706" strokeWidth={2} dot={false} strokeDasharray="6 4" isAnimationActive={false} />
          {best && <ReferenceDot yAxisId="pm" x={lbl(best)} y={best.pm25} r={7} fill="#16a34a" stroke="white" strokeWidth={2} label={{ value: 'Cleanest', position: 'top', fontSize: 11 }} />}
          {worst && <ReferenceDot yAxisId="pm" x={lbl(worst)} y={worst.pm25} r={7} fill="#dc2626" stroke="white" strokeWidth={2} label={{ value: 'Worst', position: 'top', fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

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
