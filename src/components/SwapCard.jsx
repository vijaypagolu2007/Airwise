import { formatNumber } from '../lib/impact.js'
import { MiniStat } from './ui.jsx'
import { ArrowRight, CheckCircle, PlusCircle } from '@phosphor-icons/react'

/** `swap` = AI swap text { from, to, impact_explained }; `numbers` = matching computeAllSwaps entry. */
export default function SwapCard({ swap, numbers, applied, onToggle }) {
  return (
    <div className={`card p-4 transition-colors ${applied ? '!border-emerald-400 !bg-emerald-50/50' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-slate-100 px-2 py-1 line-through decoration-red-400">{swap.from}</span>
        <ArrowRight size={16} aria-hidden="true" /><span className="sr-only">to</span>
        <span className="rounded-md bg-emerald-100 px-2 py-1 font-medium text-emerald-900">{swap.to}</span>
      </div>
      {numbers && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="PM2.5 dose cut" value={`${numbers.exposureCutUgPerDay} µg/day`} tone="sky" />
          <MiniStat label="CO₂ saved" value={`${numbers.co2KgPerWeek} kg/wk`} tone="green" />
          <MiniStat label="Money saved" value={`₹${formatNumber(numbers.moneySavedPerMonth)}/mo`} tone="amber" />
        </div>
      )}
      <p className="mt-3 text-sm text-slate-700">{swap.impact_explained}</p>
      {onToggle && numbers && (
        <button type="button" onClick={onToggle} aria-pressed={applied} className={`btn mt-3 px-3 py-1.5 text-sm ${applied ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'btn-ghost'}`}>
          {applied ? <><CheckCircle size={16} weight="fill" aria-hidden="true" /> Applied to my day</> : <><PlusCircle size={16} aria-hidden="true" /> Apply to my day</>}
        </button>
      )}
    </div>
  )
}
