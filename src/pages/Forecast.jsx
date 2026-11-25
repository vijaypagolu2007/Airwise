import { useState } from 'react'
import { ChartBar, ChartLine, CloudWarning, Sun, Table } from '@phosphor-icons/react'
import ForecastChart, { ForecastTable } from '../components/ForecastChart.jsx'
import { Panel, StatCard } from '../components/ui.jsx'
import { RequireAir } from '../components/Gates.jsx'
import { useLoadedAir } from '../context/AirwiseContext.jsx'
import { bestHour, worstHour } from '../lib/airApi.js'
import { WHO_PM25_24H } from '../lib/defaults.js'
import { avgPm25 } from '../lib/impact.js'

function Body() {
  const { air } = useLoadedAir()
  const [view, setView] = useState('chart')
  const best = bestHour(air.hourly)
  const worst = worstHour(air.hourly)
  // avgPm25 returns 0 when the next 24 h carry no PM2.5 readings; show a dash then instead of "0".
  const avg = Math.round(avgPm25(air.hourly)) || null
  /** @param {string} id @param {import('@phosphor-icons/react').Icon} Icon @param {string} text */
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
        <StatCard icon={ChartBar} tone="sky" caption="24h average PM2.5" value={avg != null ? `${avg} µg/m³` : '–'} hint={avg != null && `${(avg / WHO_PM25_24H).toFixed(1)}× WHO guideline`} />
      </div>
      <Panel title="48-hour forecast" subtitle="PM2.5 (solid) and AQI (dashed), local time" right={<div className="flex gap-2">{tab('chart', ChartLine, 'Chart')}{tab('table', Table, 'Table')}</div>}>
        {view === 'chart' ? <ForecastChart hourly={air.hourly} /> : <ForecastTable hourly={air.hourly} />}
      </Panel>
    </div>
  )
}

export default function Forecast() {
  return <RequireAir><Body /></RequireAir>
}
