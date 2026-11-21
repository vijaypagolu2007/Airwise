import { MapPin } from '@phosphor-icons/react'
import { bandForAqi } from '../lib/aqiBands.js'

const POLLUTANTS = [
  ['pm25', 'PM2.5', 'µg/m³'], ['pm10', 'PM10', 'µg/m³'], ['no2', 'NO₂', 'µg/m³'],
  ['o3', 'O₃', 'µg/m³'], ['co', 'CO', 'mg/m³'], ['so2', 'SO₂', 'µg/m³'],
]

export default function AqiCard({ place, current }) {
  const band = bandForAqi(current.aqi)
  const fmt = (k, v) => (v == null ? '–' : k === 'co' ? (v / 1000).toFixed(2) : v)
  return (
    <div className="card overflow-hidden">
      <div className="relative p-6 text-white" style={{ background: `linear-gradient(135deg, ${band.color}, ${band.color}cc)` }}>
        <div className="flex items-center gap-1.5 text-sm opacity-95">
          <MapPin size={16} weight="fill" aria-hidden="true" />
          {[place.name, place.admin1, place.country].filter(Boolean).join(', ')}
        </div>
        <div className="mt-3 flex items-end gap-4">
          <div className="font-heading text-7xl font-bold leading-none" aria-label={`AQI ${current.aqi}`}>{current.aqi ?? '–'}</div>
          <div className="pb-1">
            <div className="text-xs uppercase tracking-wide opacity-90">AQI (CPCB)</div>
            <span className="mt-1 inline-block rounded-full bg-black/20 px-3 py-0.5 text-sm font-semibold">{band.label}</span>
          </div>
        </div>
        <div className="mt-3 text-xs opacity-90">Updated {current.time?.replace('T', ' ')} local</div>
      </div>
      <dl className="grid grid-cols-3 gap-2 p-4">
        {POLLUTANTS.map(([k, label, unit]) => (
          <div key={k} className="rounded-xl bg-muted p-2.5 text-center">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold">{fmt(k, current[k])}</dd>
            <dd className="text-[10px] text-muted-foreground">{unit}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
