import { handleHealth } from './_core/handlers.js'
import { API_HEADERS } from './_core/http.js'

/** @param {unknown} _req @param {import('node:http').ServerResponse} res */
export default function handler(_req, res) {
  const out = handleHealth()
  for (const [k, v] of Object.entries(API_HEADERS)) res.setHeader(k, v)
  res.statusCode = out.status
  res.end(JSON.stringify(out.body))
}
