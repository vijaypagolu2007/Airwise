import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { searchCity } from '../lib/geocode.js'
import { fetchAirQuality } from '../lib/airApi.js'
import { DEFAULT_PROFILE } from '../lib/defaults.js'
import {
  loadProfile, saveProfile, clearProfile, hasSavedProfile,
  loadCity, saveCity, loadLang, saveLang,
} from '../lib/storage.js'

// Three small contexts instead of one: a swap toggle or an air-loading flip only re-renders
// the components that read that slice.
/** @typedef {import('../lib/types.js').Place} Place */
/** @typedef {Awaited<ReturnType<typeof fetchAirQuality>>} Air */
/** @typedef {import('react').Dispatch<import('react').SetStateAction<any>>} Setter */
/**
 * @typedef {{ place: Place | null, air: Air | null, airLoading: boolean, airError: string | null, city: string | null,
 *   setCityAndLoad: (name: string) => Promise<boolean>, loadPlace: (p: Place) => Promise<boolean>, retry: () => Promise<boolean> | null }} AirState
 * @typedef {{ profile: any, profileSaved: boolean, lang: string, updateProfile: (next: any) => void, resetProfile: () => void, setLang: (l: string) => void }} ProfileState
 * @typedef {{ advice: any, setAdvice: Setter, appliedIds: string[] | null, setAppliedIds: Setter }} PlanState
 */

const AirCtx = createContext(/** @type {AirState | null} */ (null))
const ProfileCtx = createContext(/** @type {ProfileState | null} */ (null))
const PlanCtx = createContext(/** @type {PlanState | null} */ (null))
const msg = (/** @type {unknown} */ e, /** @type {string} */ fallback) => (e instanceof Error ? e.message : fallback)

/** @param {string | null | undefined} code */
export function errorMessage(code) {
  switch (code) {
    case 'EMPTY_CITY': return 'Please type a city name.'
    case 'CITY_NOT_FOUND': return 'City not found. Check the spelling and try again.'
    case 'GEOCODE_FAILED': return "Couldn't reach the location service. Check your connection and retry."
    case 'AIR_API_FAILED': return "Couldn't load air quality data right now. Please retry."
    default: return 'Something went wrong. Please retry.'
  }
}

/** City, live air data and the loading/error state for it. */
/** @param {{ children?: import('react').ReactNode }} props */
function AirProvider({ children }) {
  const [place, setPlace] = useState(/** @type {Place | null} */ (null))
  const [air, setAir] = useState(/** @type {Air | null} */ (null))
  const [airLoading, setAirLoading] = useState(false)
  const [airError, setAirError] = useState(/** @type {string | null} */ (null))

  const loadPlace = useCallback(async (/** @type {Place} */ p) => {
    setAirLoading(true)
    setAirError(null)
    try {
      const data = await fetchAirQuality(Number(p.latitude), Number(p.longitude))
      setPlace(p)
      setAir(data)
      saveCity(JSON.stringify(p))
      return true
    } catch (e) {
      setAirError(msg(e, 'AIR_API_FAILED'))
      return false
    } finally {
      setAirLoading(false)
    }
  }, [])

  /** Geocode a name and load the first match. Returns true on success; sets airError otherwise. */
  const setCityAndLoad = useCallback(
    async (/** @type {string} */ name) => {
      const q = String(name || '').trim()
      if (!q) {
        setAirError('EMPTY_CITY')
        return false
      }
      setAirLoading(true)
      setAirError(null)
      try {
        const [first] = await searchCity(q)
        return await loadPlace(first)
      } catch (e) {
        setAirError(msg(e, 'GEOCODE_FAILED'))
        setAirLoading(false)
        return false
      }
    },
    [loadPlace],
  )

  // Restore last city on reload. The fetch starts in a microtask so no state is set during the effect itself.
  useEffect(() => {
    const raw = loadCity()
    if (!raw) return
    /** @type {Place | null} */
    let saved = null
    try {
      const p = JSON.parse(raw)
      if (p && typeof p.latitude === 'number') saved = p
    } catch {
      /* old format: plain city name */
    }
    queueMicrotask(() => (saved ? loadPlace(saved) : setCityAndLoad(raw)))
  }, [loadPlace, setCityAndLoad])

  const retry = useCallback(() => (place ? loadPlace(place) : null), [place, loadPlace])

  const value = useMemo(
    () => ({ place, air, airLoading, airError, city: place?.name ?? null, setCityAndLoad, loadPlace, retry }),
    [place, air, airLoading, airError, setCityAndLoad, loadPlace, retry],
  )
  return <AirCtx.Provider value={value}>{children}</AirCtx.Provider>
}

/** Household profile and UI language, both persisted to localStorage. */
/** @param {{ children?: import('react').ReactNode }} props */
function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(() => loadProfile())
  const [profileSaved, setProfileSaved] = useState(() => hasSavedProfile())
  const [lang, setLangState] = useState(() => loadLang() || 'en')

  const updateProfile = useCallback((/** @type {any} */ next) => {
    setProfile((prev) => {
      const merged = typeof next === 'function' ? next(prev) : { ...prev, ...next }
      saveProfile(merged)
      return merged
    })
    setProfileSaved(true)
  }, [])

  const resetProfile = useCallback(() => {
    clearProfile()
    setProfile(structuredClone(DEFAULT_PROFILE))
    setProfileSaved(false)
  }, [])

  const setLang = useCallback((/** @type {string} */ l) => {
    setLangState(l)
    saveLang(l)
  }, [])

  const value = useMemo(
    () => ({ profile, profileSaved, lang, updateProfile, resetProfile, setLang }),
    [profile, profileSaved, lang, updateProfile, resetProfile, setLang],
  )
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>
}

/** Last /api/advise result and which swaps the user has toggled on. */
/** @param {{ children?: import('react').ReactNode }} props */
function PlanProvider({ children }) {
  const [advice, setAdvice] = useState(/** @type {any} */ (null)) // keyed by `key`
  const [appliedIds, setAppliedIds] = useState(/** @type {string[] | null} */ (null)) // null = all applicable swaps applied
  const value = useMemo(() => ({ advice, setAdvice, appliedIds, setAppliedIds }), [advice, appliedIds])
  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>
}

/** @param {{ children?: import('react').ReactNode }} props */
export function AirwiseProvider({ children }) {
  return (
    <ProfileProvider>
      <AirProvider>
        <PlanProvider>{children}</PlanProvider>
      </AirProvider>
    </ProfileProvider>
  )
}

/**
 * @template T
 * @param {import('react').Context<T | null>} ctx
 * @param {string} name
 * @returns {T}
 */
function useSlice(ctx, name) {
  const v = useContext(ctx)
  if (!v) throw new Error(`${name} must be used inside AirwiseProvider`)
  return v
}

/** City and live air data. */
export const useAir = () => useSlice(AirCtx, 'useAir')
/**
 * City and air data inside <RequireAir>, where both are guaranteed to be loaded.
 * @returns {AirState & { place: Place, air: Air }}
 */
export function useLoadedAir() {
  const a = useAir()
  if (!a.place || !a.air) throw new Error('useLoadedAir must be used inside RequireAir')
  return /** @type {AirState & { place: Place, air: Air }} */ (a)
}
/** Household profile and language. */
export const useProfile = () => useSlice(ProfileCtx, 'useProfile')
/** Last advice and applied swaps. */
export const usePlanState = () => useSlice(PlanCtx, 'usePlanState')
