// Shared UI primitives (design system: design-system/MASTER.md).
import { WarningCircle, Info, ArrowClockwise } from '@phosphor-icons/react'
import { bandForAqi } from '../lib/aqiBands.js'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
      <span className="flex items-center gap-2"><WarningCircle size={20} weight="fill" aria-hidden="true" />{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="btn bg-destructive px-3 py-1.5 text-sm text-white hover:bg-red-700">
          <ArrowClockwise size={16} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  )
}

export function InfoBanner({ children, tone = 'amber' }) {
  const tones = { amber: 'border-amber-200 bg-amber-50 text-amber-900', sky: 'border-sky-200 bg-sky-50 text-sky-900' }
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`} role="status">
      <Info size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function Panel({ title, subtitle, icon: Icon, children, right, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-primary-strong">
                <Icon size={20} weight="duotone" aria-hidden="true" />
              </span>
            )}
            <div>
              <h2 className="text-lg font-semibold leading-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({ icon: Icon, value, caption, tone = 'sky', hint }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-800', green: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800', red: 'bg-red-50 text-red-800', slate: 'bg-slate-50 text-slate-700',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <span className={`grid h-7 w-7 place-items-center rounded-md ${tones[tone]}`}><Icon size={16} weight="bold" aria-hidden="true" /></span>}
        {caption}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function MiniStat({ label, value, tone = 'sky' }) {
  const tones = { sky: 'bg-sky-50', green: 'bg-emerald-50', amber: 'bg-amber-50' }
  return (
    <div className={`rounded-lg p-2.5 ${tones[tone]}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  )
}

/** Risk badge: text label + colour, never colour alone. */
export function RiskBadge({ aqi, risk }) {
  const band = bandForAqi(aqi)
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: band.color }}>
      {band.label}
      {risk && <span className="rounded-full bg-black/15 px-2 text-xs uppercase">{risk} risk</span>}
    </span>
  )
}

export function Skeleton({ className = 'h-24' }) {
  return <div className={`animate-pulse rounded-2xl bg-sky-100/70 ${className}`} aria-hidden="true" />
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="card grid place-items-center gap-3 p-10 text-center">
      {Icon && <Icon size={40} weight="duotone" className="text-primary" aria-hidden="true" />}
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </div>
  )
}
