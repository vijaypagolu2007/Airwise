// @ts-check
// Local dev API server: `pnpm run api` (port 8787). Vite proxies /api here during `pnpm dev`.
// Uses the same runPost() as the Vercel functions, so limits and error shapes match production.
import http from 'node:http'
import { handleAdvise, handleChat, handleHealth } from './api/_core/handlers.js'
import { API_HEADERS, runPost } from './api/_core/http.js'

const PORT = Number(process.env.PORT) || 8787

/** @type {Record<string, ['advise', typeof handleAdvise] | ['chat', typeof handleChat]>} */
const routes = { '/api/advise': ['advise', handleAdvise], '/api/chat': ['chat', handleChat] }

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} [headers]
 */
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...API_HEADERS, ...headers })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  // req.url is always set for requests from an http.Server, but the type allows undefined.
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path === '/api/health' && req.method === 'GET') {
    const out = handleHealth()
    return send(res, out.status, out.body)
  }
  const route = routes[path]
  if (!route) return send(res, 404, { ok: false, error: 'NOT_FOUND' })
  const [scope, handler] = route
  const out = await runPost({ method: req.method, headers: req.headers, body: req, ip: req.socket.remoteAddress }, scope, handler)
  send(res, out.status, out.body, out.headers)
})

server.listen(PORT, '127.0.0.1', () => {
  console.info(`AirWise API on http://127.0.0.1:${PORT}  (Gemini key ${process.env.GEMINI_API_KEY ? 'set' : 'MISSING → fallback mode'})`)
})
