// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import './setup.js'

const state = vi.hoisted(() => ({ air: /** @type {Record<string, unknown>} */ ({}), plan: /** @type {Record<string, unknown>} */ ({}) }))
vi.mock('../../src/context/AirwiseContext.jsx', () => ({
  useAir: () => state.air,
  errorMessage: (/** @type {string} */ code) => `error: ${code}`,
}))
vi.mock('../../src/hooks/usePlan.js', () => ({ usePlan: () => state.plan }))

const { RequireAir, RequirePlan } = await import('../../src/components/Gates.jsx')
/** @param {import('react').ReactNode} ui */
const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('RequireAir', () => {
  beforeEach(() => { state.air = { air: null, airLoading: false, airError: null, retry: vi.fn() } })

  it('shows skeletons while the first load runs', () => {
    state.air.airLoading = true
    const { container } = show(<RequireAir>child</RequireAir>)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2)
    expect(screen.queryByText('child')).toBeNull()
  })
  it('shows the error with a working retry', async () => {
    state.air.airError = 'GEO_NOT_FOUND'
    show(<RequireAir>child</RequireAir>)
    expect(screen.getByRole('alert').textContent).toContain('error: GEO_NOT_FOUND')
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(state.air.retry).toHaveBeenCalledTimes(1)
  })
  it('asks for a city when none is set', () => {
    show(<RequireAir>child</RequireAir>)
    expect(screen.getByRole('link', { name: 'Set up profile & city' }).getAttribute('href')).toBe('/profile')
  })
  it('renders its children once air data is loaded', () => {
    state.air.air = { current: { aqi: 100 } }
    show(<RequireAir>child</RequireAir>)
    expect(screen.getByText('child')).toBeTruthy()
  })
})

describe('RequirePlan', () => {
  const render2 = () => show(<RequirePlan>{(p) => <p>plan from {p.advice.source}</p>}</RequirePlan>)

  it('shows a spinner while Gemini plans', () => {
    state.plan = { loading: true }
    render2()
    expect(screen.getByText('Gemini is planning your day…')).toBeTruthy()
  })
  it('passes a Gemini plan through with no banner', () => {
    state.plan = { loading: false, offline: null, advice: { source: 'gemini' } }
    render2()
    expect(screen.getByText('plan from gemini')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('explains a server-side fallback', () => {
    state.plan = { loading: false, offline: null, advice: { source: 'fallback', error: 'AI_BUSY' } }
    render2()
    expect(screen.getByRole('status').textContent).toContain('Gemini was unavailable (AI_BUSY)')
  })
  it('explains an offline fallback', () => {
    state.plan = { loading: false, offline: 'API_UNREACHABLE', advice: { source: 'fallback' } }
    render2()
    expect(screen.getByRole('status').textContent).toContain("couldn't be reached (API_UNREACHABLE)")
  })
})
