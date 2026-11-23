import { useEffect, useMemo } from 'react'
import { useAir, useProfile, usePlanState } from '../context/AirwiseContext.jsx'
import { computeAllSwaps, computeExposureSummary } from '../lib/impact.js'
import { buildContext } from '../lib/apiClient.js'
import { requestPlan } from '../lib/planRequest.js'

/**
 * Shared plan state for every dashboard view: grounded context, code-computed swaps & exposure,
 * and the Gemini advice (fetched once per city/profile/lang, then reused across views).
 */
export function usePlan() {
  const { place, air } = useAir()
  const { profile, lang } = useProfile()
  const { advice, setAdvice, appliedIds, setAppliedIds } = usePlanState()

  const ctx = useMemo(() => (place && air ? buildContext(place, air, profile) : null), [place, air, profile])
  const swaps = useMemo(() => (ctx ? computeAllSwaps(profile, ctx.forecast24) : []), [ctx, profile])
  const applicableIds = useMemo(() => swaps.filter((s) => s.applicable).map((s) => s.id), [swaps])
  const applied = appliedIds ?? applicableIds
  const exposure = useMemo(() => (ctx ? computeExposureSummary(profile, ctx.forecast24, applied) : null), [ctx, profile, applied])

  const key = ctx ? JSON.stringify([place?.name, air?.current.time, profile, lang]) : null
  const payload = useMemo(() => {
    if (!ctx) return null
    const fullExposure = computeExposureSummary(profile, ctx.forecast24, applicableIds)
    return { ...ctx, computedImpacts: { swaps, exposure: fullExposure }, lang }
  }, [ctx, profile, applicableIds, swaps, lang])
  const have = advice?.key === key

  useEffect(() => {
    if (!key || !payload || have) return
    let alive = true
    requestPlan(key, payload).then((r) => {
      if (!alive) return
      setAppliedIds(null)
      setAdvice(r)
    })
    return () => { alive = false }
  }, [key, payload, have, setAdvice, setAppliedIds])

  const current = have ? advice : null
  /** @param {string} id */
  const toggle = (id) => setAppliedIds((prev) => {
    const base = prev ?? applicableIds
    return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
  })

  return {
    ready: !!ctx,
    loading: !!ctx && !current,
    advice: current,
    offline: current?.offline || null,
    swaps, applied, toggle, exposure, ctx,
  }
}
