import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseAst } from 'vite'
import { stripWeights, phosphorWeights, KEEP_WEIGHTS } from '../tools/phosphorWeights.js'

const DEFS = 'node_modules/@phosphor-icons/react/dist/defs'

/**
 * Read a defs module's weight → element map from its syntax tree (no evaluation): the module is
 * `new Map([["bold", <element>], ...])`, so each entry's element is compared as its exact source text.
 * Parsing also proves the stripped module is still valid JavaScript.
 * @param {string} code
 * @returns {Map<string, string>}
 */
function weights(code) {
  /** @type {Map<string, string>} */
  const out = new Map()
  /** @typedef {{ type?: string, start: number, end: number, value?: string, name?: string, callee?: AstNode, arguments?: AstNode[], elements?: AstNode[] }} AstNode */
  /** @param {AstNode} node */
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'NewExpression' && node.callee?.name === 'Map' && node.arguments?.[0]?.type === 'ArrayExpression') {
      for (const entry of node.arguments[0].elements ?? []) {
        const [key, value] = entry.elements ?? []
        out.set(String(key.value), code.slice(value.start, value.end))
      }
      return
    }
    for (const child of Object.values(node)) Array.isArray(child) ? child.forEach(visit) : visit(/** @type {AstNode} */ (child))
  }
  visit(/** @type {AstNode} */ (/** @type {unknown} */ (parseAst(code))))
  return out
}

/** @param {string} dir @returns {string[]} */
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : /\.(js|jsx)$/.test(f) ? [p] : []
})

describe('phosphor weight stripping', () => {
  it('keeps exactly the four rendered weights, unchanged, in every icon the app imports', () => {
    // Only the icons in use: checking all ~1,500 Phosphor icons takes 30 s on Windows.
    const names = new Set(walk('src').flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/import\s*\{([^}]+)\}\s*from\s*'@phosphor-icons\/react'/g)]
        .flatMap((m) => m[1].split(',').map((n) => n.trim()).filter(Boolean))))
    expect(names.size).toBeGreaterThan(20)
    const want = [...KEEP_WEIGHTS].sort().join(',')
    const problems = []
    for (const name of names) {
      const src = readFileSync(join(DEFS, `${name}.es.js`), 'utf8')
      const before = weights(src)
      const after = weights(stripWeights(src))
      if ([...after.keys()].sort().join(',') !== want) problems.push(`${name}: ${[...after.keys()]}`)
      for (const w of KEEP_WEIGHTS) {
        if (!before.get(w) || after.get(w) !== before.get(w)) problems.push(`${name} ${w} changed`)
      }
    }
    expect(problems).toEqual([])
  }, 20_000)

  it('only transforms Phosphor defs modules', () => {
    const plugin = phosphorWeights()
    const transform = /** @type {(code: string, id: string) => unknown} */ (plugin.transform)
    expect(transform('x', '/app/src/main.jsx')).toBeNull()
    const id = `/app/node_modules/@phosphor-icons/react/dist/defs/Clock.es.js`
    const out = /** @type {{ code: string }} */ (transform(readFileSync(join(DEFS, 'Clock.es.js'), 'utf8'), id))
    expect(out.code).not.toContain('"thin"')
    expect(out.code).not.toContain('"light"')
  })

  it('no source file asks for a weight the build removes', () => {
    const used = new Set(walk('src').flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/weight[=:]\s*\{?[^}\n]*?['"](\w+)['"]/g)].map((m) => m[1])))
    for (const w of used) expect(KEEP_WEIGHTS).toContain(w)
    expect(used.size).toBeGreaterThan(0)
  })
})
