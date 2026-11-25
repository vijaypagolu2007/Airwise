// @ts-check
// AirWise defaults — single source of truth for the default profile and option lists.
// Binding contract: docs/CONTRACT.md §4.

export const DEFAULT_PROFILE = {
  city: '',
  household: {
    adults: 2,
    kids: 0,
    elderly: 0,
    pregnant: false,
    asthma: false,
    copd: false,
    heart: false,
  },
  commute: { mode: 'metro', distanceKm: 8, time: '09:00' },
  home: { fuel: 'lpg', purifier: false, plants: 0, ac: false },
  outdoor: {
    walk: true,
    walkTime: '07:00',
    sports: false,
    sportsTime: '18:00',
    schoolRun: false,
    schoolRunTime: '08:00',
  },
  language: 'en',
}

export const COMMUTE_MODES = [
  'walk',
  'cycle',
  'bike',
  'car',
  'auto',
  'bus',
  'metro',
  'work_from_home',
]

/** WHO 2021 air quality guideline for 24-hour mean PM2.5, in µg/m³. */
export const WHO_PM25_24H = 15

export const FUELS = ['lpg', 'induction', 'kerosene', 'wood', 'coal']

export const LANGUAGES = ['en', 'hi', 'te']

/** Ids of the code-computed swaps (src/lib/impact.js). Gemini must reference one of these per swap. */
export const SWAP_IDS = ['walkShift', 'carToMetro', 'fuelSwap', 'purifier', 'wasteToCompost']
