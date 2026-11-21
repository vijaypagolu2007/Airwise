import HackCard from '../components/HackCard.jsx'
import { RequireAir, RequirePlan } from '../components/Gates.jsx'

export default function Indoor() {
  return (
    <RequireAir>
      <RequirePlan>
        {({ advice }) => (
          <>
            <p className="text-muted-foreground">Ranked for your household, most important first.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {advice.data.indoor_hacks.map((h, i) => <HackCard key={i} hack={h} />)}
            </div>
          </>
        )}
      </RequirePlan>
    </RequireAir>
  )
}
