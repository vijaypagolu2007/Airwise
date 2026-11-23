import { Link } from 'react-router-dom'
import { MapPinLine } from '@phosphor-icons/react'
import { useAir, errorMessage } from '../context/AirwiseContext.jsx'
import { usePlan } from '../hooks/usePlan.js'
import { Skeleton, ErrorBanner, EmptyState, InfoBanner, Spinner } from './ui.jsx'

/** Renders children only once a city's air data is loaded. */
export function RequireAir({ children }) {
  const { air, airLoading, airError, retry } = useAir()
  if (airLoading && !air) return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
  if (!air && airError) return <ErrorBanner message={errorMessage(airError)} onRetry={retry} />
  if (!air) {
    return (
      <EmptyState icon={MapPinLine} title="Pick your city first">
        <p>AirWise needs a location for live air quality.</p>
        <Link to="/profile" className="btn btn-primary mt-4">Set up profile & city</Link>
      </EmptyState>
    )
  }
  return children
}

/** Renders children with the AI plan; shows loading + fallback banners. */
export function RequirePlan({ children }) {
  const plan = usePlan()
  if (plan.loading) {
    return (
      <div className="space-y-4">
        <Spinner label="Gemini is planning your day…" />
        <Skeleton className="h-40" /><Skeleton className="h-56" />
      </div>
    )
  }
  const a = plan.advice
  return (
    <div className="space-y-4">
      {plan.offline && <InfoBanner>Offline fallback: the AirWise server couldn't be reached ({plan.offline}). Showing the rule-based plan.</InfoBanner>}
      {!plan.offline && a?.source === 'fallback' && <InfoBanner>Gemini was unavailable ({a.error}), so this uses AirWise's rule-based engine.</InfoBanner>}
      {children(plan)}
    </div>
  )
}
