// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axeViolations } from './setup.js'

vi.mock('../../src/context/AirwiseContext.jsx', async (orig) => ({
  ...(await orig()),
  useAirwise: () => ({ loadPlace, airLoading: false, airError: null, city: '' }),
}))
const loadPlace = vi.fn(async () => true)
const searchCity = vi.fn(async () => { throw new Error('CITY_NOT_FOUND') })
vi.mock('../../src/lib/geocode.js', () => ({ searchCity: (...a) => searchCity(...a) }))

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

  it('lists several matches, then loads the one picked', async () => {
    const onLoaded = vi.fn()
    const hyd = { name: 'Hyderabad', admin1: 'Telangana', country: 'India', latitude: 17.38, longitude: 78.48 }
    const sindh = { name: 'Hyderabad', admin1: 'Sindh', country: 'Pakistan', latitude: 25.39, longitude: 68.37 }
    searchCity.mockResolvedValueOnce([hyd, sindh])
    render(<CitySearch onLoaded={onLoaded} />)
    await userEvent.type(screen.getByLabelText('City'), 'Hyderabad{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: /Telangana/ }))
    expect(loadPlace).toHaveBeenCalledWith(hyd)
    expect(onLoaded).toHaveBeenCalledWith(hyd)
    expect(screen.queryByRole('button', { name: /Sindh/ })).toBeNull()
  })

  it('loads straight away when there is one match, and rejects a one-letter query', async () => {
    const delhi = { name: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2 }
    searchCity.mockResolvedValueOnce([delhi])
    render(<CitySearch />)
    const input = screen.getByLabelText('City')
    await userEvent.type(input, 'x{Enter}')
    expect(screen.getByRole('alert').textContent).toMatch(/City not found/)
    await userEvent.clear(input)
    await userEvent.type(input, 'Delhi{Enter}')
    expect(loadPlace).toHaveBeenCalledWith(delhi)
  })
})
