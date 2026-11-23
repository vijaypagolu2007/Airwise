import { useState } from 'react'
import { ChartLine, Table } from '@phosphor-icons/react'
import ForecastChart, { ForecastTable } from '../components/ForecastChart.jsx'
import { Panel, StatCard } from '../components/ui.jsx'
import { RequireAir } from '../components/Gates.jsx'
import { useLoadedAir } from '../context/AirwiseContext.jsx'
import { bestHour, worstHour } from '../lib/airApi.js'
import { Sun, CloudWarning, ChartBar } from '@phosphor-icons/react'

function Body() {
  const { air } = useLoadedAir()
  const [view, setView] = useState('chart')
  const best = bestHour(air.hourly)
  const worst = worstHour(air.hourly)
  const day = air.hourly.slice(0, 24).filter((e) => typeof e.pm25 === 'number')
  const avg = day.length ? Math.round(day.reduce((t, e) => t + (e.pm25 ?? 0), 0) / day.length) : null
  const tab = (id, Icon, text) => (
    <button onClick={() => setView(id)} aria-pressed={view === id} className={`btn px-3 py-1.5 text-sm ${view === id ? 'btn-primary' : 'btn-ghost'}`}>
      <Icon size={16} aria-hidden="true" />{text}
    </button>
  )
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Sun} tone="green" caption="Cleanest hour (6–21h)" value={best ? best.time.slice(11, 16) : '–'} hint={best && `${best.pm25} µg/m³`} />
        <StatCard icon={CloudWarning} tone="red" caption="Worst hour (6–21h)" value={worst ? worst.time.slice(11, 16) : '–'} hint={worst && `${worst.pm25} µg/m³`} />
        <StatCard icon={ChartBar} tone="sky" caption="24h average PM2.5" value={avg != null ? `${avg} µg/m³` : '–'} hint={avg != null && `${(avg / 15).toFixed(1)}× WHO guideline`} />
      </div>
      <Panel title="48-hour forecast" subtitle="PM2.5 (solid) and AQI (dashed), local time" right={<div className="flex gap-2">{tab('chart', ChartLine, 'Chart')}{tab('table', Table, 'Table')}</div>}>
        {view === 'chart' ? <ForecastChart hourly={air.hourly} height="h-96" /> : <ForecastTable hourly={air.hourly} />}
      </Panel>
    </div>
  )
}

export default function Forecast() {
  return <RequireAir><Body /></RequireAir>
}
