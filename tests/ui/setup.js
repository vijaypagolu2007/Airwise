import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import axe from 'axe-core'

afterEach(() => cleanup())

// jsdom has no layout engine, so scrolling is a no-op.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = function () {}
  window.HTMLElement.prototype.scrollTo = function () {}
}

/** Run axe on a rendered container; color-contrast needs real layout, which jsdom lacks. */
export async function axeViolations(container) {
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}
