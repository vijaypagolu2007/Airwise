import { useState } from 'react'
import { COMMUTE_MODES, FUELS } from '../lib/defaults.js'
import { validateProfile } from '../lib/validate.js'
import { UsersThree, Train, House, PersonSimpleWalk } from '@phosphor-icons/react'

const ACRONYMS = { lpg: 'LPG', ac: 'AC', ev: 'EV', cng: 'CNG' }
const label = (s) => ACRONYMS[s] ?? s.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase())
const fieldCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring'

/** @param {{ id: string, text: string, value: any, onChange: (v: string) => void, error?: string, step?: number | string }} props */
function Num({ id, text, value, onChange, error, step = 1 }) {
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="text-slate-600">{text}</span>
      <input id={id} type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)}
        className={`${fieldCls} mt-1 ${error ? 'border-red-400' : ''}`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <span id={`${id}-error`} role="alert" className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  )
}
function Check({ id, text, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm transition-colors hover:bg-sky-50">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-sky-600" />
      {text}
    </label>
  )
}
function Time({ id, text, value, onChange, disabled }) {
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="text-slate-600">{text}</span>
      <input id={id} type="time" step="3600" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className={`${fieldCls} mt-1 disabled:bg-slate-100 disabled:text-slate-400`} />
    </label>
  )
}
function Select({ id, text, value, options, onChange }) {
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="text-slate-600">{text}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldCls} mt-1 bg-white`}>
        {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
      </select>
    </label>
  )
}
function Group({ title, icon: Icon, children }) {
  return (
    <fieldset className="rounded-xl border border-border bg-white/60 p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">{Icon && <Icon size={18} weight="duotone" className="text-primary" aria-hidden="true" />}{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  )
}

/** Numbers are edited as strings and converted on submit, so typing "-1" or "" is caught by validation. */
/** @param {{ initial: any, onSave: (p: any) => void, submitText?: string }} props */
export default function ProfileForm({ initial, onSave, submitText = 'Save profile' }) {
  const [p, setP] = useState(() => structuredClone(initial))
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}))
  const set = (section, key) => (v) => setP((prev) => ({ ...prev, [section]: { ...prev[section], [key]: v } }))

  function submit(e) {
    e.preventDefault()
    const toNum = (v) => (v === '' || v === null ? NaN : Number(v))
    const candidate = {
      ...p,
      household: { ...p.household, adults: toNum(p.household.adults), kids: toNum(p.household.kids), elderly: toNum(p.household.elderly) },
      commute: { ...p.commute, distanceKm: toNum(p.commute.distanceKm) },
      home: { ...p.home, plants: toNum(p.home.plants) },
    }
    /** @type {Record<string, string>} */
    const errs = {}
    for (const k of ['adults', 'kids', 'elderly']) {
      const v = candidate.household[k]
      if (!Number.isInteger(v) || v < 0) errs[k] = 'Enter a whole number, 0 or more'
    }
    const members = (candidate.household.adults || 0) + (candidate.household.kids || 0) + (candidate.household.elderly || 0)
    if (!errs.adults && members === 0) errs.adults = 'Add at least one household member'
    const d = candidate.commute.distanceKm
    if (candidate.commute.mode !== 'work_from_home' && !(d > 0)) errs.distanceKm = 'Distance must be more than 0 km'
    if (candidate.commute.mode === 'work_from_home' && !(d >= 0)) candidate.commute.distanceKm = 0
    if (!Number.isInteger(candidate.home.plants) || candidate.home.plants < 0) errs.plants = 'Enter a whole number, 0 or more'
    if (Object.keys(errs).length === 0) {
      const v = validateProfile(candidate)
      if (!v.ok) errs.form = v.errors.join('; ')
    }
    setErrors(errs)
    if (Object.keys(errs).length === 0) onSave(candidate)
  }

  const h = p.household, c = p.commute, home = p.home, o = p.outdoor
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Group title="Household" icon={UsersThree}>
        <Num id="adults" text="Adults" value={h.adults} onChange={set('household', 'adults')} error={errors.adults} />
        <Num id="kids" text="Children" value={h.kids} onChange={set('household', 'kids')} error={errors.kids} />
        <Num id="elderly" text="Elderly (60+)" value={h.elderly} onChange={set('household', 'elderly')} error={errors.elderly} />
        <Check id="asthma" text="Someone has asthma" checked={h.asthma} onChange={set('household', 'asthma')} />
        <Check id="copd" text="Someone has COPD" checked={h.copd} onChange={set('household', 'copd')} />
        <Check id="heart" text="Heart condition" checked={h.heart} onChange={set('household', 'heart')} />
        <Check id="pregnant" text="Pregnancy in the family" checked={h.pregnant} onChange={set('household', 'pregnant')} />
      </Group>
      <Group title="Commute" icon={Train}>
        <Select id="mode" text="Main mode" value={c.mode} options={COMMUTE_MODES} onChange={set('commute', 'mode')} />
        <Num id="distanceKm" text="One-way distance (km)" step="0.5" value={c.distanceKm} onChange={set('commute', 'distanceKm')} error={errors.distanceKm} />
        <Time id="commuteTime" text="Leaves at" value={c.time} onChange={set('commute', 'time')} disabled={c.mode === 'work_from_home'} />
      </Group>
      <Group title="Home" icon={House}>
        <Select id="fuel" text="Cooking fuel" value={home.fuel} options={FUELS} onChange={set('home', 'fuel')} />
        <Num id="plants" text="Indoor plants" value={home.plants} onChange={set('home', 'plants')} error={errors.plants} />
        <Check id="purifier" text="Have an air purifier" checked={home.purifier} onChange={set('home', 'purifier')} />
        <Check id="ac" text="Have an AC" checked={home.ac} onChange={set('home', 'ac')} />
      </Group>
      <Group title="Outdoor routine" icon={PersonSimpleWalk}>
        <Check id="walk" text="Daily walk" checked={o.walk} onChange={set('outdoor', 'walk')} />
        <Time id="walkTime" text="Walk time" value={o.walkTime} onChange={set('outdoor', 'walkTime')} disabled={!o.walk} />
        <div className="hidden lg:block" />
        <Check id="sports" text="Outdoor sports / gym run" checked={o.sports} onChange={set('outdoor', 'sports')} />
        <Time id="sportsTime" text="Sports time" value={o.sportsTime} onChange={set('outdoor', 'sportsTime')} disabled={!o.sports} />
        <div className="hidden lg:block" />
        <Check id="schoolRun" text="School run" checked={o.schoolRun} onChange={set('outdoor', 'schoolRun')} />
        <Time id="schoolRunTime" text="School run time" value={o.schoolRunTime} onChange={set('outdoor', 'schoolRunTime')} disabled={!o.schoolRun} />
      </Group>
      {errors.form && <p role="alert" className="text-sm font-medium text-red-700">{errors.form}</p>}
      {Object.keys(errors).length > 0 && !errors.form && <p role="alert" className="text-sm font-medium text-red-700">Please fix the highlighted fields.</p>}
      <button type="submit" className="btn btn-primary w-full py-3 text-lg">{submitText}</button>
    </form>
  )
}
