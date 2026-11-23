// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, renderHook, waitFor } from '@testing-library/react'
import './setup.js'

const searchCity = vi.fn()
const fetchAirQuality = vi.fn()
vi.mock('../../src/lib/geocode.js', () => ({ searchCity: (...a) => searchCity(...a) }))
vi.mock('../../src/lib/airApi.js', async (orig) => ({ ...(await orig()), fetchAirQuality: (...a) => fetchAirQuality(...a) }))

const ctx = await import('../../src/context/AirwiseContext.jsx')
const { AirwiseProvider, useAir, useProfile, usePlanState, useLoadedAir, errorMessage } = ctx
const { KEYS } = await import('../../src/lib/storage.js')

const DELHI = { name: 'Delhi', latitude: 28.6, longitude: 77.2 }
const AIR = { current: { aqi: 257, time: '2026-11-23T07:00' }, hourly: [] }
const wrapper = ({ children }) => <AirwiseProvider>{children}</AirwiseProvider>
const useAll = () => ({ air: useAir(), profile: useProfile(), plan: usePlanState() })

describe('AirwiseContext', () => {
  beforeEach(() => {
    localStorage.clear()
    searchCity.mockReset()
    fetchAirQuality.mockReset()
  })

  it('maps every error code to a readable message', () => {
    for (const code of ['EMPTY_CITY', 'CITY_NOT_FOUND', 'GEOCODE_FAILED', 'AIR_API_FAILED', 'WHATEVER']) {
      expect(errorMessage(code)).toMatch(/\.$/)
    }
  })

  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAir())).toThrow('useAir must be used inside AirwiseProvider')
    expect(() => renderHook(() => useProfile())).toThrow(/useProfile/)
    expect(() => renderHook(() => usePlanState())).toThrow(/usePlanState/)
    expect(() => renderHook(() => useLoadedAir(), { wrapper })).toThrow(/RequireAir/)
  })

  it('loads a place, persists it and exposes the city', async () => {
    fetchAirQuality.mockResolvedValue(AIR)
    const { result } = renderHook(useAll, { wrapper })
    let ok
    await act(async () => { ok = await result.current.air.loadPlace(DELHI) })
    expect(ok).toBe(true)
    expect(result.current.air.city).toBe('Delhi')
    expect(result.current.air.air).toBe(AIR)
    expect(JSON.parse(localStorage.getItem(KEYS.city))).toEqual(DELHI)
    fetchAirQuality.mockResolvedValue({ ...AIR, current: { aqi: 99 } })
    await act(async () => { await result.current.air.retry() })
    expect(result.current.air.air.current.aqi).toBe(99)
  })

  it('reports empty, not-found and air failures', async () => {
    const { result } = renderHook(useAll, { wrapper })
    expect(result.current.air.retry()).toBeNull()
    await act(async () => { expect(await result.current.air.setCityAndLoad('  ')).toBe(false) })
    expect(result.current.air.airError).toBe('EMPTY_CITY')
    searchCity.mockRejectedValue(new Error('CITY_NOT_FOUND'))
    await act(async () => { await result.current.air.setCityAndLoad('Atlantis') })
    expect(result.current.air.airError).toBe('CITY_NOT_FOUND')
    searchCity.mockResolvedValue([DELHI])
    fetchAirQuality.mockRejectedValue(new Error('AIR_API_FAILED'))
    await act(async () => { await result.current.air.setCityAndLoad('Delhi') })
    expect(result.current.air.airError).toBe('AIR_API_FAILED')
    expect(result.current.air.airLoading).toBe(false)
  })

  it('restores the saved city on load, in both storage formats', async () => {
    fetchAirQuality.mockResolvedValue(AIR)
    localStorage.setItem(KEYS.city, JSON.stringify(DELHI))
    const a = renderHook(() => useAir(), { wrapper })
    await waitFor(() => expect(a.result.current.city).toBe('Delhi'))
    a.unmount()

    localStorage.setItem(KEYS.city, 'Mumbai') // old plain-name format
    searchCity.mockResolvedValue([{ name: 'Mumbai', latitude: 19, longitude: 72.8 }])
    const b = renderHook(() => useAir(), { wrapper })
    await waitFor(() => expect(b.result.current.city).toBe('Mumbai'))
    expect(searchCity).toHaveBeenCalledWith('Mumbai')
  })

  it('updates, persists and resets the profile and language', () => {
    const { result } = renderHook(useAll, { wrapper })
    expect(result.current.profile.profileSaved).toBe(false)
    act(() => result.current.profile.updateProfile({ city: 'x' }))
    expect(result.current.profile.profile.city).toBe('x')
    act(() => result.current.profile.updateProfile((p) => ({ ...p, household: { ...p.household, kids: 2 } })))
    expect(result.current.profile.profile.household.kids).toBe(2)
    expect(result.current.profile.profileSaved).toBe(true)
    expect(JSON.parse(localStorage.getItem(KEYS.profile)).household.kids).toBe(2)
    act(() => result.current.profile.resetProfile())
    expect(result.current.profile.profileSaved).toBe(false)
    act(() => result.current.profile.setLang('hi'))
    expect(result.current.profile.lang).toBe('hi')
    expect(localStorage.getItem(KEYS.lang)).toBe('hi')
  })

  it('keeps plan state separate from air state', () => {
    const renders = { air: 0 }
    function AirReader() { useAir(); renders.air += 1; return null }
    function PlanWriter() {
      const { appliedIds, setAppliedIds } = usePlanState()
      return <button onClick={() => setAppliedIds(['ac'])}>{appliedIds ? appliedIds.join() : 'all'}</button>
    }
    render(<AirwiseProvider><AirReader /><PlanWriter /></AirwiseProvider>)
    const before = renders.air
    act(() => screen.getByRole('button').click())
    expect(screen.getByRole('button').textContent).toBe('ac')
    expect(renders.air).toBe(before) // a swap toggle does not re-render air consumers
  })
})
