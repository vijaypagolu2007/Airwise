// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileForm from '../../src/components/ProfileForm.jsx'
import { DEFAULT_PROFILE } from '../../src/lib/defaults.js'
import { validateProfile } from '../../src/lib/validate.js'
import { axeViolations } from './setup.js'

describe('ProfileForm', () => {
  it('saves a valid profile that passes the shared schema', async () => {
    const onSave = vi.fn()
    render(<ProfileForm initial={DEFAULT_PROFILE} onSave={onSave} />)
    await userEvent.click(screen.getByLabelText('Someone has asthma'))
    await userEvent.selectOptions(screen.getByLabelText('Main mode'), 'car')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0]
    expect(saved.household.asthma).toBe(true)
    expect(saved.commute.mode).toBe('car')
    expect(validateProfile(saved).ok).toBe(true)
  })

  it('blocks a negative count and links the error to its field', async () => {
    const onSave = vi.fn()
    render(<ProfileForm initial={DEFAULT_PROFILE} onSave={onSave} />)
    const kids = screen.getByLabelText('Children')
    await userEvent.clear(kids)
    await userEvent.type(kids, '-1')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(kids.getAttribute('aria-invalid')).toBe('true')
    const msg = document.getElementById(kids.getAttribute('aria-describedby'))
    expect(msg.textContent).toBe('Enter a whole number, 0 or more')
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('needs at least one household member', async () => {
    const onSave = vi.fn()
    render(<ProfileForm initial={{ ...DEFAULT_PROFILE, household: { ...DEFAULT_PROFILE.household, adults: 0 } }} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(screen.getByText('Add at least one household member')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('disables the walk time when there is no daily walk', async () => {
    render(<ProfileForm initial={DEFAULT_PROFILE} onSave={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('Daily walk'))
    expect(screen.getByLabelText('Walk time')).toHaveProperty('disabled', true)
  })

  it('has no axe violations', async () => {
    const { container } = render(<ProfileForm initial={DEFAULT_PROFILE} onSave={vi.fn()} />)
    expect(await axeViolations(container)).toEqual([])
  })
})
