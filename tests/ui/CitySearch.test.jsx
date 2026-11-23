// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axeViolations } from './setup.js'

vi.mock('../../src/context/AirwiseContext.jsx', async (orig) => ({
  ...(await orig()),
  useAirwise: () => ({ loadPlace: vi.fn(), airLoading: false, airError: null, city: '' }),
}))
vi.mock('../../src/lib/geocode.js', () => ({ searchCity: vi.fn(async () => { throw new Error('CITY_NOT_FOUND') }) }))

const { default: CitySearch } = await import('../../src/components/CitySearch.jsx')

describe('CitySearch', () => {
  it('gives each instance its own ids when mounted twice (header + profile)', async () => {
    const { container } = render(<><CitySearch compact /><CitySearch /></>)
    const inputs = screen.getAllByLabelText('City')
    expect(inputs).toHaveLength(2)
    expect(inputs[0].id).not.toBe(inputs[1].id)
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(await axeViolations(container)).toEqual([])
  })

  it('shows a linked alert for a blank city', async () => {
    render(<CitySearch />)
    const input = screen.getByLabelText('City')
    expect(input.getAttribute('aria-describedby')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /search/i }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Please type a city name.')
    expect(input.getAttribute('aria-describedby')).toBe(alert.id)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('shows "City not found" from the geocoder', async () => {
    render(<CitySearch />)
    await userEvent.type(screen.getByLabelText('City'), 'asdfgh{Enter}')
    expect((await screen.findByRole('alert')).textContent).toMatch(/City not found/)
  })
})
