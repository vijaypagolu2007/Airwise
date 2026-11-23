import { Link } from 'react-router-dom'
import { Sun, CloudWarning, Heartbeat, Leaf, Sparkle } from '@phosphor-icons/react'
import AqiCard from '../components/AqiCard.jsx'
import ShareCard from '../components/ShareCard.jsx'
import { StatCard, RiskBadge, Skeleton } from '../components/ui.jsx'
import { RequireAir } from '../components/Gates.jsx'
import { useLoadedAir, useProfile } from '../context/AirwiseContext.jsx'
import { usePlan } from '../hooks/usePlan.js'
import { bestHour, worstHour } from '../lib/airApi.js'
import { formatNumber } from '../lib/impact.js'

function Body() {
  const { place, air } = useLoadedAir()
  const { lang } = useProfile()
  const plan = usePlan()
  const best = bestHour(air.hourly)
  const worst = worstHour(air.hourly)
  const applied = plan.swaps.filter((s) => plan.applied.includes(s.id))
  const co2 = applied.reduce((t, s) => t + (s.co2KgPerWeek || 0), 0)
  const money = applied.reduce((t, s) => t + (s.moneySavedPerMonth || 0), 0)
  const d = plan.advice?.data
  const top = d?.translated?.topActions || d?.routine.slice(0, 3).map((r) => `${r.time} · ${r.activity}`) || []

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="xl:col-span-1"><AqiCard place={place} current={air.current} /></div>

      <div className="space-y-5 xl:col-span-2">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Sun} tone="green" caption="Cleanest hour" value={best ? best.time.slice(11, 16) : '–'} hint={best && `${best.pm25} µg/m³ PM2.5`} />
          <StatCard icon={CloudWarning} tone="red" caption="Worst hour" value={worst ? worst.time.slice(11, 16) : '–'} hint={worst && `${worst.pm25} µg/m³ PM2.5`} />
          <StatCard icon={Heartbeat} tone="sky" caption="Dose you can cut" value={plan.exposure ? `${plan.exposure.cutPercent}%` : '–'} hint={plan.exposure && `${formatNumber(plan.exposure.cutUg)} µg PM2.5 today`} />
          <StatCard icon={Leaf} tone="amber" caption="Savings" value={`${co2.toFixed(1)} kg`} hint={`CO₂/week · ₹${formatNumber(money)}/mo`} />
        </div>

        <section className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkle size={20} weight="fill" className="text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Today's AI summary</h2>
            {d && <RiskBadge aqi={air.current.aqi} risk={d.risk_level} />}
            {plan.advice && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${plan.advice.source === 'gemini' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'}`}>{plan.advice.source === 'gemini' ? 'Gemini' : 'Fallback'}</span>}
          </div>
          {plan.loading ? <Skeleton className="mt-3 h-16" /> : (
            <>
              <p className="mt-3 text-lg">{d?.translated?.summary || d?.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/routine" className="btn btn-primary">See my routine</Link>
                <Link to="/swaps" className="btn btn-accent">Swaps & impact</Link>
                <Link to="/chat" className="btn btn-ghost">Ask a question</Link>
              </div>
            </>
          )}
        </section>

        {top.length > 0 && <ShareCard city={place.name} aqi={air.current.aqi} actions={top} lang={lang} />}
      </div>
    </div>
  )
}

export default function Overview() {
  return <RequireAir><Body /></RequireAir>
}
