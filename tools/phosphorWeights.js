// @ts-check
// Phosphor ships six weights of every icon. AirWise only renders four, so the build drops the
// other two ("light", "thin") from each icon's path map. On the icons AirWise uses, this
// cuts the icons chunk from about 110 kB to 75 kB (25 to 15 kB gzip) with no change to how any icon looks.

/** Weights the UI may render. tests/icons.test.js fails if source code asks for any other. */
export const KEEP_WEIGHTS = /** @type {const} */ (['regular', 'bold', 'fill', 'duotone'])
export const DROP_WEIGHTS = ['light', 'thin']

const DEFS = /@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/][^\\/]+\.es\.js$/

/**
 * Remove the dropped weights' `["light", <element>]` entries from one defs module.
 * Each entry is a two-item array literal; the element never contains `]`-closing brackets of its own
 * at the top level, so we cut from the entry's opening `[` up to the next weight entry or the Map's end.
 * @param {string} code
 * @returns {string}
 */
export function stripWeights(code) {
  let out = code
  for (const w of DROP_WEIGHTS) {
    // From `[ "w",` to just before the next `[ "x",` entry or the closing `]);` of the Map.
    out = out.replace(new RegExp(String.raw`,?\s*\[\s*"${w}",[\s\S]*?\)\)\s*\](?=\s*,|\s*\]\);)`), '')
  }
  return out.replace(/\[\s*,/, '[')
}

/** @returns {import('vite').Plugin} */
export function phosphorWeights() {
  return {
    name: 'airwise:phosphor-weights',
    enforce: 'pre',
    transform(code, id) {
      if (!DEFS.test(id)) return null
      return { code: stripWeights(code), map: null }
    },
  }
}
