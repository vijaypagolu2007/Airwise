import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { searchCity } from '../lib/geocode.js'
import { fetchAirQuality } from '../lib/airApi.js'
import { DEFAULT_PROFILE } from '../lib/defaults.js'
import {
  loadProfile, saveProfile, clearProfile, hasSavedProfile,
  loadCity, saveCity, loadLang, saveLang,
} from '../lib/storage.js'

const Ctx = createContext(null)

export function errorMessage(code) {
  switch (code) {
    case 'EMPTY_CITY': return 'Please type a city name.'
    case 'CITY_NOT_FOUND': return 'City not found. Check the spelling and try again.'
    case 'GEOCODE_FAILED': return "Couldn't reach the location service. Check your connection and retry."
    case 'AIR_API_FAILED': return "Couldn't load air quality data right now. Please retry."
    default: return 'Something went wrong. Please retry.'
  }
}

export function AirwiseProvider({ children }) {
  const [profile, setProfile] = useState(() => loadProfile())
  const [profileSaved, setProfileSaved] = useState(() => hasSavedProfile())
  const [place, setPlace] = useState(null) // { name, admin1, country, latitude, longitude }
  const [air, setAir] = useState(null)
  const [airLoading, setAirLoading] = useState(false)
  const [airError, setAirError] = useState(null)
  const [lang, setLangState] = useState(() => loadLang() || 'en')
  const [advice, setAdvice] = useState(null) // last /api/advise result, keyed by `key`
  const [appliedIds, setAppliedIds] = useState(null) // null = all applicable swaps applied

  const loadPlace = useCallback(async (p) => {
    setAirLoading(true)
    setAirError(null)
    try {
      const data = await fetchAirQuality(p.latitude, p.longitude)
      setPlace(p)
      setAir(data)
      saveCity(JSON.stringify(p))
      return true
    } catch (e) {
      setAirError(e.message)
      return false
    } finally {
      setAirLoading(false)
    }
  }, [])

  /** Geocode a name and load the first match. Returns true on success; sets airError otherwise. */
  const setCityAndLoad = useCallback(
    async (name) => {
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
        setAirError(e.message)
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
    let place = null
    try {
      const p = JSON.parse(raw)
      if (p && typeof p.latitude === 'number') place = p
    } catch {
      /* old format: plain city name */
    }
    queueMicrotask(() => (place ? loadPlace(place) : setCityAndLoad(raw)))
  }, [loadPlace, setCityAndLoad])

  const updateProfile = useCallback((next) => {
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

  const setLang = useCallback((l) => {
    setLangState(l)
    saveLang(l)
  }, [])

  const value = useMemo(
    () => ({
      profile, profileSaved, place, air, airLoading, airError, lang, advice, setAdvice, appliedIds, setAppliedIds,
      city: place?.name ?? null,
      setCityAndLoad, loadPlace, updateProfile, resetProfile, setLang,
      retry: () => (place ? loadPlace(place) : null),
    }),
    [profile, profileSaved, place, air, airLoading, airError, lang, advice, appliedIds, setCityAndLoad, loadPlace, updateProfile, resetProfile, setLang],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAirwise() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAirwise must be used inside AirwiseProvider')
  return v
}
