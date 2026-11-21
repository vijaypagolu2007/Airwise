import { Link } from 'react-router-dom'
import ExposureMeter from '../components/ExposureMeter.jsx'
import { Panel } from '../components/ui.jsx'
import { RequireAir } from '../components/Gates.jsx'
import { usePlan } from '../hooks/usePlan.js'
import { Heartbeat } from '@phosphor-icons/react'

function Body() {
  const { exposure, swaps, applied, toggle } = usePlan()
  const usable = swaps.filter((s) => s.applicable)
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel className="lg:col-span-2" icon={Heartbeat} title="Your PM2.5 dose today" subtitle="Household-average inhaled dose, before vs after the swaps you apply">
        {exposure && <ExposureMeter summary={exposure} />}
      </Panel>
      <Panel title="Swaps applied">
        <ul className="space-y-2">
          {usable.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-sky-50">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-sky-700" checked={applied.includes(s.id)} onChange={() => toggle(s.id)} />
                <span><span className="font-medium">{s.to}</span><span className="block text-xs text-muted-foreground">−{s.exposureCutUgPerDay} µg/day</span></span>
              </label>
            </li>
          ))}
        </ul>
        <Link to="/swaps" className="btn btn-ghost mt-4 w-full text-sm">See swap details</Link>
      </Panel>
    </div>
  )
}
export default function Exposure() {
  return <RequireAir><Body /></RequireAir>
}
