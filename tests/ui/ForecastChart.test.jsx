// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ForecastChart, { ForecastTable } from '../../src/components/ForecastChart.jsx'
import './setup.js'

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

const hourly = [
  { time: '2026-11-23T07:00', pm25: 119.7, aqi: 299 },
  { time: '2026-11-23T15:00', pm25: 42, aqi: 71 },
  { time: '2026-11-23T18:00', pm25: 66.4, aqi: 122 },
]

describe('ForecastChart', () => {
  it('describes the cleanest and worst hour for screen readers', () => {
    render(<ForecastChart hourly={hourly} />)
    const label = screen.getByRole('img').getAttribute('aria-label')
    expect(label).toContain('Cleanest hour 15:00 at 42')
    expect(label).toContain('worst 07:00 at 119.7')
  })

  it('renders the table fallback with one row per hour', () => {
    render(<ForecastTable hourly={[...hourly, { time: '2026-11-23T19:00', pm25: null, aqi: null }]} />)
    expect(screen.getAllByRole('row')).toHaveLength(5)
    expect(screen.getAllByText('–')).toHaveLength(2)
  })
})
