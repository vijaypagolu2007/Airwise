// @ts-check
// Adapter: a framework-free handler → a Vercel Node function. Limits and errors live in http.js.
import { API_HEADERS, runPost } from './http.js'

/**
 * @param {'advise' | 'chat'} scope
 * @param {(body: unknown) => Promise<{ status: number, body: unknown }>} handler
 */
export function vercelPost(scope, handler) {
  /**
   * @param {import('node:http').IncomingMessage & { body?: unknown }} req
   * @param {import('node:http').ServerResponse} res
   */
  return async function (req, res) {
    let body
    try {
      // Vercel pre-parses JSON bodies; when it hasn't, the request itself is the stream.
      body = req.body !== undefined ? req.body : req
    } catch {
      // Vercel's body getter throws on malformed JSON: answer with our own error instead of an empty 400.
      body = '\u0000invalid'
    }
    const out = await runPost({ method: req.method, headers: req.headers, body, ip: req.socket?.remoteAddress }, scope, handler)
    for (const [k, v] of Object.entries({ ...API_HEADERS, ...out.headers })) res.setHeader(k, v)
    res.statusCode = out.status
    res.end(JSON.stringify(out.body))
  }
}
