// @ts-check
// Adapter: a framework-free handler → a Vercel Node function. Limits and errors live in http.js.
import { API_HEADERS, runPost } from './http.js'

/**
 * @param {'advise' | 'chat'} scope
 * @param {(body: unknown) => Promise<{ status: number, body: unknown }>} handler
 */
export function vercelPost(scope, handler) {
  /** @param {any} req @param {any} res */
  return async function (req, res) {
    // Vercel pre-parses JSON bodies; when it hasn't, the request itself is the stream.
    const body = req.body !== undefined ? req.body : req
    const out = await runPost({ method: req.method, headers: req.headers, body, ip: req.socket?.remoteAddress }, scope, handler)
    for (const [k, v] of Object.entries({ ...API_HEADERS, ...out.headers })) res.setHeader(k, v)
    res.statusCode = out.status
    res.end(JSON.stringify(out.body))
  }
}
