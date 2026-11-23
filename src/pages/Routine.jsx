import { Clock, ListChecks } from '@phosphor-icons/react'
import RoutineList from '../components/RoutineList.jsx'
import { Panel, RiskBadge } from '../components/ui.jsx'
import { RequireAir, RequirePlan } from '../components/Gates.jsx'
import { useLoadedAir } from '../context/AirwiseContext.jsx'

function Body() {
  const { air, place } = useLoadedAir()
  return (
    <RequirePlan>
      {({ advice }) => {
        const d = advice.data
        return (
          <div className="grid gap-5 lg:grid-cols-5">
            <Panel className="lg:col-span-3" icon={Clock} title={`Low-emission day in ${place.name}`} subtitle="Timed to the cleanest hours in the forecast" right={<RiskBadge aqi={air.current.aqi} risk={d.risk_level} />}>
              <RoutineList items={d.routine} />
            </Panel>
            <div className="space-y-5 lg:col-span-2">
              <Panel title="In one line">
                <p className="text-lg">{d.summary}</p>
                <p className="mt-3 text-xs text-muted-foreground">Not medical advice. People with health conditions should follow their doctor's guidance.</p>
              </Panel>
              {d.translated && (
                <Panel icon={ListChecks} title="Top actions">
                  <p className="font-medium">{d.translated.summary}</p>
                  <ul className="ml-5 mt-2 list-disc text-sm">{d.translated.topActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </Panel>
              )}
            </div>
          </div>
        )
      }}
    </RequirePlan>
  )
}
export default function Routine() {
  return <RequireAir><Body /></RequireAir>
}
