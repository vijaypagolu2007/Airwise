// @ts-check
// AirWise geocoding — Open-Meteo geocoding API.
// Binding contract: docs/CONTRACT.md §1.

/**
 * Search for a city by name.
 * @param {string} query
 * @returns {Promise<Array<{ name: string, admin1?: string, country?: string, country_code?: string, latitude: number, longitude: number }>>}
 * @throws {Error} 'CITY_NOT_FOUND' when the API returns an empty result set.
 * @throws {Error} 'GEOCODE_FAILED' on network, HTTP, or parse failures.
 */
export async function searchCity(query) {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(query)}&count=6&language=en&format=json`

  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error('GEOCODE_FAILED')
  }
  if (!res || !res.ok) throw new Error('GEOCODE_FAILED')

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error('GEOCODE_FAILED')
  }

  const results = json && Array.isArray(json.results) ? json.results : []
  if (results.length === 0) throw new Error('CITY_NOT_FOUND')

  return results.map((/** @type {any} */ r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    country_code: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
  }))
}
