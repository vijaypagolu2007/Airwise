import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  SquaresFour, ChartLineUp, Clock, House, Leaf, Heartbeat, ChatsCircle, Robot, UserCircleGear,
  List, X, Translate,
} from '@phosphor-icons/react'
import { useAir, useProfile } from '../context/AirwiseContext.jsx'
import { LANGUAGES } from '../lib/defaults.js'
import { bandForAqi } from '../lib/aqiBands.js'
import CitySearch from './CitySearch.jsx'

/** @type {Record<string, string>} */
const LANG_NAMES = { en: 'English', hi: 'हिन्दी', te: 'తెలుగు' }

export const MENU = [
  { group: 'Air today', items: [
    { to: '/overview', label: 'Overview', icon: SquaresFour },
    { to: '/forecast', label: 'Forecast', icon: ChartLineUp },
  ] },
  { group: 'My AI plan', items: [
    { to: '/routine', label: 'Daily routine', icon: Clock },
    { to: '/indoor', label: 'Indoor hacks', icon: House },
    { to: '/swaps', label: 'Swaps & impact', icon: Leaf },
    { to: '/exposure', label: 'Exposure meter', icon: Heartbeat },
  ] },
  { group: 'Assistant', items: [
    { to: '/chat', label: 'Ask AirWise', icon: ChatsCircle },
    { to: '/inspector', label: 'AI inspector', icon: Robot },
  ] },
  { group: 'Settings', items: [
    { to: '/profile', label: 'Profile & city', icon: UserCircleGear },
  ] },
]
const ALL = MENU.flatMap((g) => g.items)

function Logo() {
  return (
    <NavLink to="/overview" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-9 w-9" />
      <span className="font-heading text-2xl font-bold text-primary-strong">AirWise</span>
    </NavLink>
  )
}

/** @param {{ onNavigate?: () => void }} props */
function Menu({ onNavigate }) {
  return (
    <nav aria-label="Main" className="space-y-5">
      {MENU.map((g) => (
        <div key={g.group}>
          <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</div>
          <ul className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                      isActive ? 'bg-primary-strong text-white shadow-md shadow-sky-900/10' : 'text-slate-700 hover:bg-white/80'
                    }`}
                >
                  {({ isActive }) => (<><Icon size={20} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />{label}</>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function AirChip() {
  const { place, air } = useAir()
  if (!place || !air) return null
  const band = bandForAqi(air.current.aqi)
  return (
    <div className="rounded-xl border border-white/80 bg-white/70 p-3">
      <div className="text-xs text-muted-foreground">Now in {place.name}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: band.color }} aria-hidden="true" />
        <span className="text-lg font-bold">AQI {air.current.aqi}</span>
        <span className="text-sm text-muted-foreground">{band.label}</span>
      </div>
    </div>
  )
}

function LangSelect() {
  const { lang, setLang } = useProfile()
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <Translate size={18} className="text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
        {LANGUAGES.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
      </select>
    </label>
  )
}

/** @param {{ children?: import('react').ReactNode }} props */
export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const current = ALL.find((i) => pathname.startsWith(i.to))
  const closeRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const drawerRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const menuButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  useEffect(() => { document.getElementById('main')?.scrollTo(0, 0) }, [pathname])
  // Drawer: focus the close button on open, Escape closes, focus returns to the menu button.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Escape') return setOpen(false)
      if (e.key !== 'Tab' || !drawerRef.current) return
      // Keep Tab / Shift+Tab inside the open drawer.
      const items = [...drawerRef.current.querySelectorAll(/** @type {'a'} */ ('a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])'))].map((el) => /** @type {HTMLElement} */ (el))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const trigger = menuButtonRef.current
    return () => { document.removeEventListener('keydown', onKey); trigger?.focus() }
  }, [open])

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-5">
      <Logo />
      <AirChip />
      <div className="flex-1 overflow-y-auto"><Menu onNavigate={() => setOpen(false)} /></div>
      <p className="text-xs text-muted-foreground">Air data: Open-Meteo · AI: Gemini<br />Not medical advice</p>
    </div>
  )

  return (
    <div className="flex h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-white focus:p-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="glass hidden w-72 shrink-0 border-r lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div ref={drawerRef} className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={() => setOpen(false)} />
          <aside className="glass absolute inset-y-0 left-0 w-72 !bg-white/95">
            <button ref={closeRef} onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 hover:bg-slate-100" aria-label="Close menu"><X size={22} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col" inert={open || undefined}>
        <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 lg:px-8">
          <button ref={menuButtonRef} onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white lg:hidden" aria-label="Open menu" aria-expanded={open}><List size={24} /></button>
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            {current && <current.icon size={26} weight="duotone" className="text-primary" aria-hidden="true" />}
            {current?.label ?? 'AirWise'}
          </h1>
          <div className="ml-auto hidden w-72 md:block"><CitySearch compact /></div>
          <LangSelect />
        </header>
        <main id="main" className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
