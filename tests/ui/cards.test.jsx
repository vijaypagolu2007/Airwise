// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AqiCard from '../../src/components/AqiCard.jsx'
import ExposureMeter from '../../src/components/ExposureMeter.jsx'
import HackCard from '../../src/components/HackCard.jsx'
import PromptPanel from '../../src/components/PromptPanel.jsx'
import RoutineList from '../../src/components/RoutineList.jsx'
import ShareCard from '../../src/components/ShareCard.jsx'
import { Spinner, ErrorBanner, InfoBanner, Panel, StatCard, MiniStat, RiskBadge, Skeleton, EmptyState } from '../../src/components/ui.jsx'
import { Sun } from '@phosphor-icons/react'
import { axeViolations } from './setup.js'

const place = { name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2 }
const current = { aqi: 312, pm25: 180, pm10: 260, no2: 40, o3: null, co: 1500, so2: 9, time: '2026-11-25T10:00' }

describe('AqiCard', () => {
  it('shows the place, the CPCB band and every pollutant, with a dash for missing ones', async () => {
    const { container } = render(<AqiCard place={place} current={current} />)
    expect(screen.getByText('Delhi, Delhi, India')).toBeTruthy()
    expect(screen.getByLabelText('AQI 312').textContent).toBe('312')
    expect(screen.getByText('Very Poor')).toBeTruthy()
    expect(screen.getByText('1.50')).toBeTruthy() // CO shown in mg/m³
    expect(screen.getByText('–')).toBeTruthy() // O₃ missing
    expect(screen.getByText(/Updated 2026-11-25 10:00/)).toBeTruthy()
    expect(await axeViolations(container)).toEqual([])
  })
})

describe('ExposureMeter', () => {
  const summary = {
    before: { totalUg: 400, byActivity: [{ id: 'commute', label: 'Car commute', ug: 300 }, { id: 'home', label: 'Home', ug: 100 }] },
    after: { totalUg: 250, byActivity: [{ id: 'commute', label: 'Metro commute', ug: 150 }] },
    cutUg: 150,
    cutPercent: 38,
  }
  it('compares before and after and names the swap that changed an activity', async () => {
    const { container } = render(<ExposureMeter summary={summary} />)
    expect(screen.getByText(/38% lower/)).toBeTruthy()
    expect(screen.getByText('Car commute → Metro commute')).toBeTruthy()
    expect(screen.getByText('Home')).toBeTruthy()
    expect(await axeViolations(container)).toEqual([])
  })
})

describe('HackCard', () => {
  it('shows the tip, the reason and the effort', () => {
    render(<HackCard hack={{ tip: 'Shut windows at 7 pm', why: 'PM2.5 peaks after dark.', effort: 'low' }} />)
    expect(screen.getByRole('heading', { name: 'Shut windows at 7 pm' })).toBeTruthy()
    expect(screen.getByText('low effort')).toBeTruthy()
  })
  it('falls back to the low-effort style for an unknown effort', () => {
    render(<HackCard hack={{ tip: 'Mop floors', why: 'Dust settles.', effort: 'odd' }} />)
    expect(screen.getByText('odd effort').className).toContain('emerald')
  })
})

describe('PromptPanel', () => {
  it('opens to show the prompt and the pretty-printed model reply', async () => {
    render(<PromptPanel prompt="PROMPT" raw='{"summary":"ok"}' source="gemini" cached />)
    const toggle = screen.getByRole('button', { expanded: false })
    expect(screen.getByText('Gemini')).toBeTruthy()
    expect(screen.getByText('cached')).toBeTruthy()
    await userEvent.click(toggle)
    expect(screen.getByLabelText('Prompt sent').textContent).toBe('PROMPT')
    expect(screen.getByLabelText('Raw model response').textContent).toBe('{\n  "summary": "ok"\n}')
  })
  it('explains a fallback, shows non-JSON text as is, and has no axe violations', async () => {
    const { container, rerender } = render(<PromptPanel prompt={null} raw={null} source="fallback" error="AI_BUSY" defaultOpen />)
    expect(screen.getByText('Fallback')).toBeTruthy()
    expect(screen.getByLabelText('Prompt sent').textContent).toBe('(none)')
    expect(screen.getByLabelText('Raw model response').textContent).toMatch(/rule-based fallback/)
    expect(screen.getByText('Fallback reason: AI_BUSY')).toBeTruthy()
    expect(await axeViolations(container)).toEqual([])
    rerender(<PromptPanel prompt="p" raw="not json" source="gemini" defaultOpen />)
    expect(screen.getByLabelText('Raw model response').textContent).toBe('not json')
  })
})

describe('RoutineList', () => {
  it('lists each step with its time, activity and reason', () => {
    render(<RoutineList items={[{ time: '07:00', activity: 'Walk', reason: 'Cleanest hour' }, { time: '19:00', activity: 'Purifier on', reason: 'Evening peak' }]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Purifier on')).toBeTruthy()
  })
})

describe('ShareCard', () => {
  it('builds a WhatsApp link with the numbered actions and copies the same text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ShareCard city="Delhi" aqi={312} actions={['Mask outdoors', 'Purifier on']} lang="hi" />)
    const link = screen.getByRole('link', { name: /WhatsApp पर भेजें/ })
    const text = decodeURIComponent(link.getAttribute('href').split('text=')[1])
    expect(text).toContain('1. Mask outdoors\n2. Purifier on')
    await userEvent.click(screen.getByRole('button', { name: /कॉपी करें/ }))
    expect(writeText).toHaveBeenCalledWith(text)
    expect(await screen.findByText('कॉपी हो गया!')).toBeTruthy()
  })
  it('falls back to English and survives a blocked clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    const { container } = render(<ShareCard city="Pune" aqi={80} actions={['Walk at 7']} lang="xx" />)
    await userEvent.click(screen.getByRole('button', { name: /Copy/ }))
    expect(screen.queryByText('Copied!')).toBeNull()
    expect(await axeViolations(container)).toEqual([])
  })
})

describe('ui primitives', () => {
  it('render their content with text labels, not colour alone', async () => {
    const onRetry = vi.fn()
    const { container } = render(
      <div>
        <Spinner />
        <ErrorBanner message="Network down" onRetry={onRetry} />
        <ErrorBanner message="No retry" />
        <InfoBanner tone="sky">FYI</InfoBanner>
        <Panel title="Panel title" subtitle="sub" icon={Sun} right={<span>R</span>}>body</Panel>
        <Panel>untitled</Panel>
        <StatCard icon={Sun} caption="Cleanest" value="07:00" hint="40 µg/m³" tone="green" />
        <StatCard caption="Plain" value="1" />
        <MiniStat label="Saved" value="₹200" tone="amber" />
        <RiskBadge aqi={312} risk="high" />
        <RiskBadge aqi={40} />
        <Skeleton />
        <EmptyState icon={Sun} title="Nothing yet">hint</EmptyState>
      </div>,
    )
    expect(screen.getByText('Loading…')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Panel title' })).toBeTruthy()
    expect(screen.getByText('high risk')).toBeTruthy()
    expect(screen.getByText('Good')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeTruthy()
    expect(await axeViolations(container)).toEqual([])
  })
})
