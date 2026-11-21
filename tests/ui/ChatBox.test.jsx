// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatBox from '../../src/components/ChatBox.jsx'
import { axeViolations } from './setup.js'

describe('ChatBox', () => {
  it('sends a trimmed question and clears the input', async () => {
    const onSend = vi.fn()
    render(<ChatBox messages={[]} onSend={onSend} sending={false} />)
    const input = screen.getByLabelText('Your question')
    await userEvent.type(input, '  Can I run at 6 pm?  {enter}')
    expect(onSend).toHaveBeenCalledWith('Can I run at 6 pm?')
    expect(input).toHaveProperty('value', '')
  })

  it('shows an accessible error for an empty question and does not send', async () => {
    const onSend = vi.fn()
    render(<ChatBox messages={[]} onSend={onSend} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Type a question first.')
    expect(screen.getByLabelText('Your question').getAttribute('aria-describedby')).toBe(alert.id)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('a sample question fills the input', async () => {
    render(<ChatBox messages={[]} onSend={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: /windows open tonight/ }))
    expect(screen.getByLabelText('Your question')).toHaveProperty('value', 'Should we keep windows open tonight?')
  })

  it('announces replies in a live log and labels fallback answers', () => {
    render(
      <ChatBox
        sending
        onSend={vi.fn()}
        messages={[{ role: 'user', content: 'Safe at 5?' }, { role: 'model', content: 'No, wait until 3 pm.', source: 'fallback', error: 'AI_BUSY' }]}
      />,
    )
    const log = screen.getByRole('log')
    expect(log.getAttribute('aria-live')).toBe('polite')
    expect(log.textContent).toContain('AirWise: No, wait until 3 pm.')
    expect(log.textContent).toContain('Rule-based fallback (AI_BUSY)')
    expect(screen.getByRole('status').textContent).toMatch(/thinking/)
    expect(screen.getByRole('button', { name: 'Send' })).toHaveProperty('disabled', true)
  })

  it('has no axe violations', async () => {
    const { container } = render(<ChatBox messages={[{ role: 'user', content: 'hi' }]} onSend={vi.fn()} sending={false} />)
    expect(await axeViolations(container)).toEqual([])
  })
})
