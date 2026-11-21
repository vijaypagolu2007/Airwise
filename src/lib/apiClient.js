// @ts-check
// Browser → /api calls. Throws 'API_UNREACHABLE' when the server itself can't be reached.
/**
 * @param {string} path
 * @param {unknown} body
 * @returns {Promise<any>}
 */
async function post(path, body) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('API_UNREACHABLE')
  }
  let json
  try {
    json = await res.json()
  } catch {
    throw new Error('API_UNREACHABLE')
  }
  if (!res.ok || !json.ok) {
    throw Object.assign(new Error(json?.error || 'API_ERROR'), { details: json?.details })
  }
  return json
}

/** @param {unknown} body */
export const postAdvise = (body) => post('/api/advise', body)
/** @param {unknown} body */
export const postChat = (body) => post('/api/chat', body)

/**
 * Shared grounded context sent to both endpoints.
 * @param {import('./types.js').Place} place
 * @param {{ current: import('./types.js').AqiNow, hourly: import('./types.js').HourEntry[] }} air
 * @param {import('./types.js').Profile} profile
 */
export function buildContext(place, air, profile) {
  const forecast24 = air.hourly.slice(0, 24).filter((e) => typeof e.pm25 === 'number' && typeof e.aqi === 'number')
  return {
    location: { name: place.name, admin1: place.admin1, country: place.country, latitude: place.latitude, longitude: place.longitude },
    aqiNow: air.current,
    forecast24,
    profile,
  }
}
