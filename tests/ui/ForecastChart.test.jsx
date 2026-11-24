// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ForecastChart, { ForecastTable } from '../../src/components/ForecastChart.jsx'
import { axeViolations } from './setup.js'

const hourly = [
  { time: '2026-11-23T07:00', pm25: 119.7, aqi: 299 },
  { time: '2026-11-23T15:00', pm25: 42, aqi: 71 },
  { time: '2026-11-23T18:00', pm25: 66.4, aqi: 122 },
]

describe('ForecastChart', () => {
  it('describes the cleanest and worst hour for screen readers', async () => {
    const { container } = render(<ForecastChart hourly={hourly} />)
    const label = screen.getByRole('img').getAttribute('aria-label')
    expect(label).toContain('Cleanest hour 15:00 at 42')
    expect(label).toContain('worst 07:00 at 119.7')
    expect(screen.getByText('Cleanest')).toBeTruthy()
    expect(screen.getByText('Worst')).toBeTruthy()
    expect(await axeViolations(container)).toEqual([])
  })

  it('shows the hovered hour and clears it on leave', () => {
    render(<ForecastChart hourly={hourly} />)
    const svg = screen.getByRole('img')
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 320, right: 800, bottom: 320, x: 0, y: 0, toJSON() {} })
    fireEvent.pointerMove(svg, { clientX: 790 })
    expect(screen.getByText(/2026-11-23 18:00 · PM2.5 66.4 · AQI 122/)).toBeTruthy()
    fireEvent.pointerLeave(svg)
    expect(screen.queryByText(/PM2.5 66.4 ·/)).toBeNull()
  })

  it('ignores pointer moves before layout', () => {
    render(<ForecastChart hourly={hourly} />)
    const svg = screen.getByRole('img')
    fireEvent.pointerMove(svg, { clientX: 10 })
    expect(screen.queryByText(/· AQI/)).toBeNull()
  })

  it('reads layout once per pointer entry', () => {
    render(<ForecastChart hourly={hourly} />)
    const svg = screen.getByRole('img')
    let reads = 0
    svg.getBoundingClientRect = () => { reads++; return { left: 0, top: 0, width: 800, height: 320, right: 800, bottom: 320, x: 0, y: 0, toJSON() {} } }
    fireEvent.pointerEnter(svg)
    fireEvent.pointerMove(svg, { clientX: 100 })
    fireEvent.pointerMove(svg, { clientX: 790 })
    expect(reads).toBe(1)
    expect(screen.getByText(/18:00 · PM2.5 66.4/)).toBeTruthy()
  })

  it('re-reads layout after a resize or scroll', () => {
    const { unmount } = render(<ForecastChart hourly={hourly} />)
    const svg = screen.getByRole('img')
    let reads = 0
    let width = 800
    svg.getBoundingClientRect = () => { reads++; return { left: 0, top: 0, width, height: 320, right: width, bottom: 320, x: 0, y: 0, toJSON() {} } }
    fireEvent.pointerEnter(svg)
    fireEvent.pointerMove(svg, { clientX: 790 })
    expect(reads).toBe(1)
    width = 400
    fireEvent(window, new Event('resize'))
    fireEvent.pointerMove(svg, { clientX: 10 })
    expect(reads).toBe(2)
    expect(screen.getByText(/07:00 · PM2.5 119.7/)).toBeTruthy()
    fireEvent.scroll(window)
    fireEvent.pointerMove(svg, { clientX: 395 })
    expect(reads).toBe(3)
    expect(screen.getByText(/18:00 · PM2.5 66.4/)).toBeTruthy()
    unmount()
  })

  it('scrubs hours with the keyboard', () => {
    render(<ForecastChart hourly={hourly} />)
    const chart = screen.getByRole('group')
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByText(/15:00 · PM2.5 42 ·/)).toBeTruthy()
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByText(/18:00 · PM2.5 66.4 ·/)).toBeTruthy()
    fireEvent.keyDown(chart, { key: 'Home' })
    expect(screen.getByText(/07:00 · PM2.5 119.7 ·/)).toBeTruthy()
    fireEvent.keyDown(chart, { key: 'ArrowLeft' })
    expect(screen.getByText(/07:00 · PM2.5 119.7 ·/)).toBeTruthy()
    fireEvent.keyDown(chart, { key: 'End' })
    expect(screen.getByText(/18:00 · PM2.5 66.4 ·/)).toBeTruthy()
    fireEvent.keyDown(chart, { key: 'q' })
    expect(screen.getByText(/18:00 · PM2.5 66.4 ·/)).toBeTruthy()
    fireEvent.keyDown(chart, { key: 'Escape' })
    expect(screen.queryByText(/· AQI/)).toBeNull()
    fireEvent.keyDown(chart, { key: 'ArrowLeft' })
    fireEvent.blur(chart)
    expect(screen.queryByText(/· AQI/)).toBeNull()
  })

  it('renders the table fallback with one row per hour', () => {
    render(<ForecastTable hourly={[...hourly, { time: '2026-11-23T19:00', pm25: null, aqi: null }]} />)
    expect(screen.getAllByRole('row')).toHaveLength(5)
    expect(screen.getAllByText('–')).toHaveLength(2)
  })
})
