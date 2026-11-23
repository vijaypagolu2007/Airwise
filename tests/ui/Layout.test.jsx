// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import './setup.js'

vi.mock('../../src/context/AirwiseContext.jsx', async (orig) => ({
  ...(await orig()),
  useAir: () => ({
    place: { name: 'Delhi' }, air: { current: { aqi: 257 } },
    loadPlace: vi.fn(), airLoading: false, airError: null, city: 'Delhi',
  }),
  useProfile: () => ({ lang: 'en', setLang: vi.fn() }),
}))
const { default: Layout } = await import('../../src/components/Layout.jsx')

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><Layout><p>page</p></Layout></MemoryRouter>)

describe('Layout', () => {
  it('titles the page from the menu and shows the live AQI chip', () => {
    renderAt('/routine')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Daily routine')
    expect(screen.getAllByText('AQI 257').length).toBeGreaterThan(0)
  })

  it('mobile drawer: focuses close, makes the page inert, traps Tab, closes on Escape', async () => {
    renderAt('/overview')
    const openBtn = screen.getByRole('button', { name: 'Open menu' })
    await userEvent.click(openBtn)
    const dialog = screen.getByRole('dialog', { name: 'Menu' })
    const close = screen.getByRole('button', { name: 'Close menu' })
    expect(document.activeElement).toBe(close)
    expect(openBtn.closest('[inert]')).not.toBeNull()

    const focusables = dialog.querySelectorAll('a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])')
    const last = focusables[focusables.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(focusables[0])
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(openBtn)
  })
})
