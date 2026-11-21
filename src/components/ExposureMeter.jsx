import { formatNumber } from '../lib/impact.js'

export default function ExposureMeter({ summary }) {
  const { before, after, cutUg, cutPercent } = summary
  const max = Math.max(before.totalUg, 1)
  const bar = (v, color) => (
    <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(2, (v / max) * 100)}%` }} />
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm"><span>Before</span><span className="font-semibold">{formatNumber(before.totalUg)} µg</span></div>
        {bar(before.totalUg, 'bg-red-500')}
        <div className="flex justify-between text-sm"><span>After applied swaps</span><span className="font-semibold">{formatNumber(after.totalUg)} µg</span></div>
        {bar(after.totalUg, 'bg-emerald-500')}
      </div>
      <div className="rounded-xl bg-emerald-50 p-3 text-center text-emerald-900" aria-live="polite">
        You'd inhale <b>{formatNumber(cutUg)} µg less PM2.5</b> today ({cutPercent}% lower).
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-1">Activity</th><th>Before</th><th>After</th></tr></thead>
        <tbody>
          {before.byActivity.map((b) => {
            const a = after.byActivity.find((x) => x.id === b.id)
            return (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="py-1.5">{b.label}{a && a.label !== b.label ? ` → ${a.label}` : ''}</td>
                <td>{formatNumber(b.ug)} µg</td>
                <td className={a && a.ug < b.ug ? 'font-semibold text-emerald-700' : ''}>{formatNumber(a?.ug ?? b.ug)} µg</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Dose = PM2.5 × minutes × breathing rate × activity factor. Numbers are computed in code, not by AI.</p>
    </div>
  )
}
