import { useId, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { searchCity } from '../lib/geocode.js'
import { useAir, errorMessage } from '../context/AirwiseContext.jsx'

/** @typedef {import('../lib/types.js').Place} Place */

/** @param {{ onLoaded?: (p: Place) => void, compact?: boolean }} props */
export default function CitySearch({ onLoaded, compact = false }) {
  const { loadPlace, airLoading, airError, city } = useAir()
  const uid = useId()
  const inputId = `city-${uid}`
  const errorId = `city-error-${uid}`
  const [q, setQ] = useState(city || '')
  const [results, setResults] = useState(/** @type {Place[]} */ ([]))
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [searching, setSearching] = useState(false)

  /** @param {import('react').FormEvent<HTMLFormElement>} e */
  async function onSubmit(e) {
    e.preventDefault()
    setResults([])
    const query = q.trim()
    if (!query) return setError('EMPTY_CITY')
    if (query.length < 2) return setError('CITY_NOT_FOUND')
    setError(null)
    setSearching(true)
    try {
      const found = await searchCity(query)
      if (found.length === 1) await pick(found[0])
      else setResults(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GEOCODE_FAILED')
    } finally {
      setSearching(false)
    }
  }

  /** @param {Place} p */
  async function pick(p) {
    setResults([])
    setQ(p.name)
    const ok = await loadPlace(p)
    if (ok && onLoaded) onLoaded(p)
  }

  const shown = error || airError
  return (
    <div className="relative">
      <form onSubmit={onSubmit} className="flex gap-2" noValidate>
        <label htmlFor={inputId} className="sr-only">City</label>
        <input
          id={inputId}
          value={q}
          onChange={(e) => { setQ(e.target.value); setError(null) }}
          placeholder={compact && city ? `Change city (now ${city})` : "Type your city, e.g. Delhi"}
          className={`w-full rounded-xl border bg-white ${compact ? 'px-3 py-2' : 'px-4 py-3 text-lg'} outline-none focus:ring-2 focus:ring-ring ${shown ? 'border-red-400' : 'border-slate-300'}`}
          aria-invalid={!!shown}
          aria-describedby={shown ? errorId : undefined}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={searching || airLoading}
          className={`btn btn-primary ${compact ? "px-3 py-2" : "px-5 py-3"}`}
        >
          <MagnifyingGlass size={18} weight="bold" aria-hidden="true" /><span className={compact ? 'sr-only' : ''}>{searching || airLoading ? 'Loading…' : 'Search'}</span>
        </button>
      </form>
      {shown && <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-600">{errorMessage(shown)}</p>}
      {results.length > 1 && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button type="button" onClick={() => pick(r)} className="w-full px-4 py-3 text-left hover:bg-sky-50">
                <span className="font-medium">{r.name}</span>
                <span className="text-sm text-slate-600">{[r.admin1, r.country].filter(Boolean).join(', ') && ` · ${[r.admin1, r.country].filter(Boolean).join(', ')}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
