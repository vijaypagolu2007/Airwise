// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SwapCard from '../../src/components/SwapCard.jsx'
import { axeViolations } from './setup.js'

const swap = { id: 'carToMetro', from: 'Car commute', to: 'Metro', impact_explained: 'Cuts your dose.' }
const numbers = { id: 'carToMetro', exposureCutUgPerDay: 42.5, co2KgPerWeek: 15.7, moneySavedPerMonth: 7200 }

describe('SwapCard', () => {
  it('shows the code-computed numbers next to the AI text', () => {
    render(<SwapCard swap={swap} numbers={numbers} applied={false} onToggle={vi.fn()} />)
    expect(screen.getByText('42.5 µg/day')).toBeTruthy()
    expect(screen.getByText('15.7 kg/wk')).toBeTruthy()
    expect(screen.getByText(/₹7,200\/mo/)).toBeTruthy()
    expect(screen.getByText('Cuts your dose.')).toBeTruthy()
  })

  it('toggle is a pressed/unpressed button', async () => {
    const onToggle = vi.fn()
    const { rerender } = render(<SwapCard swap={swap} numbers={numbers} applied={false} onToggle={onToggle} />)
    const btn = screen.getByRole('button', { name: /Apply to my day/ })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
    rerender(<SwapCard swap={swap} numbers={numbers} applied onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: /Applied to my day/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('without matching numbers there are no stats and no toggle', () => {
    render(<SwapCard swap={swap} numbers={null} applied={false} onToggle={null} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/µg\/day/)).toBeNull()
  })

  it('has no axe violations', async () => {
    const { container } = render(<SwapCard swap={swap} numbers={numbers} applied={false} onToggle={vi.fn()} />)
    expect(await axeViolations(container)).toEqual([])
  })
})
