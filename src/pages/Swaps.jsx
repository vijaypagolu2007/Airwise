import { Link } from 'react-router-dom'
import SwapCard from '../components/SwapCard.jsx'
import { RequireAir, RequirePlan } from '../components/Gates.jsx'

export default function Swaps() {
  return (
    <RequireAir>
      <RequirePlan>
        {({ advice, swaps, applied, toggle, exposure }) => {
          const ai = advice.data.swaps.length ? advice.data.swaps : swaps.filter((s) => s.applicable).map((s) => ({ id: s.id, from: s.from, to: s.to, impact_explained: s.why }))
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground">Numbers computed by AirWise; explanations written by Gemini. Toggle a swap to update your exposure.</p>
                {exposure && <Link to="/exposure" className="btn btn-ghost text-sm">Dose cut so far: {exposure.cutPercent}%</Link>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {ai.map((s, i) => {
                  const n = swaps.find((c) => c.id === s.id) || null
                  return <SwapCard key={s.id || i} swap={s} numbers={n} applied={n ? applied.includes(n.id) : false} onToggle={n ? () => toggle(n.id) : null} />
                })}
              </div>
            </>
          )
        }}
      </RequirePlan>
    </RequireAir>
  )
}
