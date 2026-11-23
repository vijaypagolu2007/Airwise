import { Lightbulb } from '@phosphor-icons/react'

/** @type {Record<string, string>} */
const EFFORT = { low: 'bg-emerald-100 text-emerald-800', med: 'bg-amber-100 text-amber-800', high: 'bg-red-100 text-red-800' }

/** @param {{ hack: import('../lib/types.js').IndoorHack }} props */
export default function HackCard({ hack }) {
  return (
    <div className="card h-full p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex gap-2 font-sans font-semibold"><Lightbulb size={20} weight="duotone" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{hack.tip}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${EFFORT[hack.effort] || EFFORT.low}`}>{hack.effort} effort</span>
      </div>
      <p className="mt-1 pl-7 text-sm text-muted-foreground">{hack.why}</p>
    </div>
  )
}
