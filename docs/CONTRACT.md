# AirWise Module Contract (binding for all implementers)

Project root: `C:\Users\vijay\Downloads\PWV-6\airwise` (this file lives in `docs/`).
Source of truth for cross-module integration. Do NOT rename exports, files, routes, or shapes
defined here. Do NOT edit `package.json`, `vite.config.js`, `index.html`, or this file.

Available deps (already in package.json): react, react-dom, react-router-dom, recharts, zod.
Do NOT add new dependencies. Use template strings for class names (no clsx).

---

## 1. `src/lib/geocode.js`

- `export async function searchCity(query)`
  - GET `https://geocoding-api.open-meteo.com/v1/search?name=<encodeURIComponent(query)>&count=6&language=en&format=json`
  - Returns `Promise<Array<{ name, admin1, country, country_code, latitude, longitude }>>`
    (admin1/country may be undefined — pass through).
  - Empty array → throw `new Error('CITY_NOT_FOUND')`. Network/non-200/parse failure →
    throw `new Error('GEOCODE_FAILED')`.

## 2. `src/lib/airApi.js`

- `export async function fetchAirQuality(lat, lon)`
  - GET `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=<lat>&longitude=<lon>&current=pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide&hourly=pm2_5,pm10,nitrogen_dioxide&timezone=auto&forecast_days=2`
  - Returns normalised:
    ```js
    {
      location: { latitude, longitude, timezone, utcOffsetSeconds },
      current: { time, aqi, pm25, pm10, no2, o3, co, so2 },   // numbers rounded to 1 dp
      hourly:  [ { time, aqi, pm25, pm10, no2 }, /* 48 entries */ ]
    }
    ```
    Map API fields: aqi = cpcbAqi(pm2_5, pm10) (CPCB scale, src/lib/aqiBands.js), pm2_5→pm25, nitrogen_dioxide→no2, ozone→o3,
    carbon_monoxide→co, sulphur_dioxide→so2. `time` strings stay as returned (local, e.g. `"2026-11-18T07:00"`).
  - Failure → throw `new Error('AIR_API_FAILED')`.
- `export function pm25AtHour(hourly, hhmm)`
  - `hhmm` like `"07:00"`. Find entry in the first 24 entries whose `time` ends with `T${hhmm}`.
  - If none matches exactly, pick the entry whose hour (parse `T` + first 2 digits) is closest
    (tie → the later hour). Returns the whole hourly entry object.
- `export function bestHour(hourly, startHour = 6, endHour = 21)`
  - Among entries whose hour-of-day is in [startHour, endHour] (first 24 entries), return the
    entry with the lowest `pm25`. Tie → earliest.
- `export function worstHour(hourly, startHour = 6, endHour = 21)`
  - Same but highest `pm25`.

## 3. `src/lib/aqiBands.js`

```js
export const AQI_BANDS = [
  { min: 0,   max: 50,  label: 'Good',        color: '#16a34a', chip: 'bg-green-600' },
  { min: 51,  max: 100, label: 'Satisfactory', color: '#65a30d', chip: 'bg-lime-600' },
  { min: 101, max: 200, label: 'Moderate',    color: '#ca8a04', chip: 'bg-yellow-500' },
  { min: 201, max: 300, label: 'Poor',        color: '#ea580c', chip: 'bg-orange-500' },
  { min: 301, max: 400, label: 'Very Poor',   color: '#dc2626', chip: 'bg-red-600' },
  { min: 401, max: 500, label: 'Severe',      color: '#991b1b', chip: 'bg-red-900' },
]
export function bandForAqi(aqi) // → { ...band, index } ; values > 500 clamp to Severe
export function aqiToRisk(aqi)  // 'low' (≤100) | 'moderate' (101–200) | 'high' (201–300) | 'severe' (>300)
```

## 4. `src/lib/defaults.js`

```js
export const DEFAULT_PROFILE = {
  city: '',
  household: { adults: 2, kids: 0, elderly: 0, pregnant: false,
               asthma: false, copd: false, heart: false },
  commute:   { mode: 'metro', distanceKm: 8, time: '09:00' },
  home:      { fuel: 'lpg', purifier: false, plants: 0, ac: false },
  outdoor:   { walk: true, walkTime: '07:00', sports: false, sportsTime: '18:00',
               schoolRun: false, schoolRunTime: '08:00' },
  language:  'en',
}
export const COMMUTE_MODES = ['walk','cycle','bike','car','auto','bus','metro','work_from_home']
export const FUELS = ['lpg','induction','kerosene','wood','coal']
export const LANGUAGES = ['en','hi','te']
```

## 5. `src/lib/impact.js` — deterministic math (all numbers from code, not AI)

Constants (document these in a comment block in the file):
```js
RATE_LPM      = { adult: 12, child: 10, elderly: 11, pregnant: 12.5 }      // litres/min
MULT          = { rest: 1, commute: 1.4, walk: 3, cycle: 3.5, sports: 5 }  // activity multiplier
MIN_PER_KM    = { walk: 12, cycle: 3.5, bike: 3, car: 2.5, auto: 3, bus: 2.2, metro: 2 }
OUTDOOR_FACTOR= { walk: 1, cycle: 1, bike: 1, car: 0.6, auto: 0.8, bus: 1, metro: 0.5 }
INDOOR_RATIO  = 0.6                    // indoor = outdoor × 0.6 + cooking term
COOK_PM       = { induction: 15, lpg: 40, kerosene: 90, wood: 250, coal: 280 } // µg/m³ during cooking
CO2_G_PER_KM  = { walk: 0, cycle: 0, metro: 14, bus: 60, bike: 85, auto: 105, car: 171, work_from_home: 0 }
COST_PER_KM   = { walk: 0, cycle: 0, metro: 3, bus: 4, bike: 3.5, auto: 9, car: 12, work_from_home: 0 } // ₹
TRIPS_PER_DAY = 2, WORKDAYS_PER_WEEK = 5, WEEKS_PER_MONTH = 4
```

Exports (all pure; round outputs to 1 dp with `Math.round(x*10)/10` unless noted):

- `exposureUg(conc, minutes, rateLpm, mult = 1)` = `conc × minutes × rateLpm × mult / 1000`
- `householdRate(profile)` — weighted mean breathing rate: members = adults×12 + kids×10 +
  elderly×11 + (pregnant ? 12.5 : 0); divided by member count. Guard count=0 → 12.
- `indoorConc(outdoorPm25, fuel)` = `outdoorPm25 × 0.6 + COOK_PM[fuel]`
- `commuteMinutes(mode, distanceKm)` = `round(distanceKm × MIN_PER_KM[mode])`
- `activityExposure(profile, hourly)` → `Array<{ id, label, conc, minutes, rate, mult, ug }>`
  (the un-optimised "before" day; conc = PM2.5 µg/m³ used):
  - `walk` (if outdoor.walk): conc=pm25AtHour(hourly, walkTime).pm25, 45 min, rate=householdRate, mult=MULT.walk
  - `commute` (always, even work_from_home→minutes 0, ug 0): conc=pm25AtHour(hourly, commute.time).pm25,
    minutes=commuteMinutes×2, rate=householdRate, mult=MULT.commute × OUTDOOR_FACTOR[mode]
  - `schoolRun` (if household.kids>0 && outdoor.schoolRun): conc at schoolRunTime, 30 min, mult=MULT.walk
  - `sports` (if outdoor.sports): conc at sportsTime, 60 min, mult=MULT.sports
  - `cooking`: conc=indoorConc(mean pm25 of first 24 entries, home.fuel), 60 min, mult=MULT.rest
  - ug = exposureUg(conc, minutes, rate, mult) for each.
- `computeAllSwaps(profile, hourly)` → `Array<Swap>`, one entry per rule (include `applicable: false`
  entries too, so the UI can show what would change):
  ```js
  Swap = { id, from, to, co2KgPerWeek, moneySavedPerMonth, exposureCutUgPerDay, why, applicable }
  ```
  Rules (in this order):
  1. `walkShift` (applicable: outdoor.walk): from=`Morning walk at ${walkTime}`, to=`Walk at ${bestHour.time.slice(11,16)}`
     (cleanest hour). co2 0, money 0. exposureCut = walk exposure at original hour − walk exposure
     at bestHour (45 min, householdRate, MULT.walk). why: `You inhale ~3× more air during a brisk
     walk, so shifting it to the cleanest hour cuts your daily PM2.5 dose by ${cut} µg.`
  2. `carToMetro` (applicable: commute.mode in ['car','auto','bike']): from=`${mode} commute
     (${distanceKm} km)`, to=`Metro / public transport`. co2KgPerWeek =
     `distanceKm × 2 × 5 × (CO2_G_PER_KM[mode] − 14) / 1000`; moneySavedPerMonth =
     `distanceKm × 2 × 5 × 4 × (COST_PER_KM[mode] − 3)`; exposureCut = commute exposure with
     mode − commute exposure recomputed with metro factors (minutes via MIN_PER_KM.metro,
     mult = MULT.commute × 0.5). why: `One metro trip replaces a private vehicle trip: per person
     CO₂ drops from ${CO2_G_PER_KM[mode]} g/km to ~14 g/km.`
  3. `fuelSwap` (applicable: home.fuel in ['wood','coal','kerosene']): from=`${fuel} cooking`,
     to=`LPG / induction cooking`. co2KgPerWeek = 22 (wood/coal) or 15 (kerosene);
     moneySavedPerMonth = 400; exposureCut = cooking exposure with fuel − cooking exposure with
     'lpg' (60 min, rest mult). why: `Solid-fuel cooking can push indoor PM2.5 past 300 µg/m³ —
     switching fuel removes most of that plume.`
  4. `purifier` (applicable: !home.purifier): from=`No air purifier`, to=`Air purifier or DIY
     Corsi-Rosenthal box fan filter`. co2 0, money 0. exposureCut = `indoorConc(avgPm25, fuel) × 0.4 × 720 × householdRate / 1000`
     (12 h/day at home, rest breathing; avgPm25 = mean of first 24 pm25). why: `A box-fan + MERV-13
     filter removes ~60% of indoor PM2.5 for under ₹2,000.`
  5. `wasteToCompost` (applicable: true): from=`Open waste burning in the neighbourhood`,
     to=`Composting + segregated waste pickup`. co2 8, money 0, exposureCut 30 (fixed,
     community-level estimate). why: `Burning trash releases PM2.5 and dioxins next to homes;
     segregating and composting removes that source.`
- `computeExposureSummary(profile, hourly, appliedSwapIds = [])` →
  `{ before: { totalUg, byActivity }, after: { totalUg, byActivity }, cutUg, cutPercent }`
  - before = activityExposure(profile, hourly).
  - after = same but: walkShift applied → walk at bestHour; carToMetro applied → metro factors;
    fuelSwap applied → fuel 'lpg'; purifier applied → cooking and a new `homeIndoor` line (12 h at
    home) reduced 40% (homeIndoor added to both before and after when purifier present or applied:
    before uses full indoorConc, after × 0.6). Add `homeIndoor` item: id 'homeIndoor', label
    '12 h indoors at home', conc=indoorConc(avgPm25, fuel), minutes=720, rate=householdRate, mult=1.
  - cutUg = before.totalUg − after.totalUg (never below 0); cutPercent = round(cutUg/before.totalUg×100).
- `formatNumber(n)` → locale string helper `n.toLocaleString('en-IN', { maximumFractionDigits: 0 })` — optional extra.

## 6. `src/lib/storage.js`

```js
export const KEYS = { profile: 'airwise.profile.v1', city: 'airwise.city.v1', lang: 'airwise.lang.v1' }
export function loadProfile()   // parse+shallow-merge with DEFAULT_PROFILE; never throws
export function saveProfile(p)
export function clearProfile()
export function loadCity()      // string | null
export function saveCity(name)
export function loadLang()      // 'en'|'hi'|'te' | null
export function saveLang(l)
```

## 7. `src/lib/validate.js` (zod v4)

- `export const ProfileSchema` — zod schema for DEFAULT_PROFILE shape (all fields; enums for
  mode/fuel/language; numbers non-negative).
- `export function validateProfile(json)` → `{ ok: true, data } | { ok: false, errors: string[] }`
- `export const AdviceSchema`:
  ```js
  z.object({
    summary: z.string().min(1),
    risk_level: z.enum(['low','moderate','high','severe']),
    routine: z.array(z.object({ time: z.string().min(1), activity: z.string().min(1),
      reason: z.string().min(1) })).max(12),
    indoor_hacks: z.array(z.object({ tip: z.string().min(1), why: z.string().min(1),
      effort: z.enum(['low','med','high']) })).max(8),
    swaps: z.array(z.object({ from: z.string().min(1), to: z.string().min(1),
      impact_explained: z.string().min(1) })).max(6),
  })
  ```
- `export function validateAdvice(json)` → `{ ok: true, data } | { ok: false, errors: string[] }`
- `export const AdviseRequestSchema` and `export function validateAdviseRequest(json)` — same ok/errors
  shape; schema fields:
  ```js
  {
    location: z.object({ name: z.string().min(1), admin1: z.string().optional(),
      country: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() }),
    aqiNow: z.object({ aqi: z.number(), pm25: z.number(),
      pm10: z.number().optional(), no2: z.number().optional(), time: z.string().optional() }),
    forecast24: z.array(z.object({ time: z.string().min(1), aqi: z.number(), pm25: z.number(),
      pm10: z.number().optional(), no2: z.number().optional() })).min(1).max(48),
    profile: z.record(z.string(), z.any()),
    computedImpacts: z.record(z.string(), z.any()).optional(),
    lang: z.enum(['en','hi','te']).optional(),
  }
  ```
- `export const ChatRequestSchema` + `export function validateChatRequest(json)`:
  ```js
  {
    location: <same as above>, aqiNow: <same>, forecast24: <same>, profile: z.record(z.string(), z.any()),
    question: z.string().min(1).max(1000),
    history: z.array(z.object({ role: z.enum(['user','model']), content: z.string() })).max(12).optional(),
  }
  ```

## 8. `src/lib/fallback.js` — rule-based advice, same shape as Gemini output

- `export function fallbackAdvice({ location, aqiNow, forecast24, profile, computedImpacts })`
  returns an object matching AdviceSchema. Deterministic rules:
  - `risk_level` = aqiToRisk(aqiNow.aqi).
  - `summary`: one sentence per band using location.name and aqiNow values, e.g. severe:
    `"Air in ${name} is Severe (AQI ${aqi}). Minimise outdoor exertion today and keep indoor air
    as clean as possible."` (write one template per band; mention pm25 when >100).
  - `routine` (5–7 items, times as `"HH:MM"`, always sorted):
    - Ventilation: aqi≤100 → `"Open windows in the morning for fresh air"` at 07:00;
      aqi 101–300 → `"Ventilate during the cleanest window"` at bestHour time (reason cites the
      window); aqi>300 → `"Keep windows closed; brief ventilation only in the cleanest hour"`.
    - If outdoor.walk: walk moved to bestHour when aqi>100 else walkTime; reason cites pm25 at that hour.
    - If kids>0: school run at schoolRunTime — aqi>200 adds `"with N95 mask for the child"`, reason cites AQI.
    - Commute at commute.time: if mode car/auto/bike and aqi>200 → `"Take metro/bus today"` reason cites CO₂/₹ numbers from computedImpacts.swaps (carToMetro) when present, else generic.
    - If outdoor.sports: sports at best hour ≥16:00 with lowest pm25 (pick from bestHour/worstHour helpers on forecast24); reason cites pm25.
    - If home.fuel wood/coal/kerosene: `"Cook on LPG/induction today, exhaust on"` at 18:00.
    - If aqi>150: `"Wet-mop floors in the evening"` at 20:00.
  - `indoor_hacks` (order: risk-first — if asthma/elderly/kids/pregnant → put 'Close windows during
    traffic peaks 8–10 & 17–20' first; purifier missing → Corsi-Rosenthal box fan; then seal gaps;
    wet mopping; kitchen exhaust; fuel switch if solid fuel; plants caution if plants>0; filter
    cleaning if purifier). Each { tip, why, effort } with plain-language `why` citing the mechanism
    (e.g. infiltration, resuspension, plume). At least 4 hacks, at most 7.
  - `swaps`: for each applicable swap from `computeAllSwaps(profile, forecast24)`:
    `{ from, to, impact_explained }` where impact_explained is one sentence citing the computed
    numbers (co2KgPerWeek, moneySavedPerMonth, exposureCutUgPerDay) when computedImpacts is
    provided, otherwise generic mechanism text without numbers.

## 9. API layer

### `api/core/prompt.js`
- `export const SYSTEM_PROMPT` — air-health advisor persona: cite CPCB/WHO AQI bands, never give
  medical diagnoses, answer in strict JSON matching the schema, base every claim on the numbers
  provided (AQI/forecast/computedImpacts), disclaimers for vulnerable groups.
- `export function buildAdvisePrompt(input)` → full prompt string = SYSTEM_PROMPT + JSON schema +
  `Today's data:` + JSON.stringify(input) + instruction to return ONLY the JSON object.
- `export function buildChatPrompt(input)` → conversational prompt with same persona, grounded in
  `input` data, plain text reply ≤ 200 words, no markdown headers, end with a one-line disclaimer
  when the question concerns health symptoms.

### `api/core/gemini.js`
- `export async function callGeminiJson(prompt)`:
  - key = `process.env.GEMINI_API_KEY`; if missing → throw `new Error('NO_API_KEY')`.
  - model = `process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'`. On HTTP 429/5xx or a network error, one retry on `process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite'`.
  - POST `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    body `{ contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }`.
  - Return `{ text, raw }` where text = `candidates[0].content.parts.map(p=>p.text).join('')`
    trimmed (strip leading/trailing ``` fences if present), raw = full response body JSON string.
  - Non-200 → throw `new Error('GEMINI_HTTP_' + status)`; no candidates → `new Error('GEMINI_EMPTY')`.

### `api/core/cache.js`
- `export function getCache(key)` / `setCache(key, value)` — in-memory Map, TTL 60 min (store
  `{ at, value }`). Key built by caller. (Per-instance cache is fine for the free tier.)

### `api/core/fallback.js`
- `export function serverFallback(input)` — same rules as `src/lib/fallback.js` §8. Implement
  self-contained here (no import from src/), mirroring the §8 rules, because serverless functions
  must stay independent. Deterministic and identical in shape.

### `api/advise.js` (Vercel function)
- `export default async function handler(req, res)`; POST `/api/advise`.
- Parse JSON body (cap ~64 KB) → `validateAdviseRequest` from `../src/lib/validate.js`
  (Vercel bundles cross-dir imports). Invalid → 400 `{ ok:false, error }`.
- cacheKey = `${location.name}|${lang}|${Math.round(aqiNow.aqi/10)}|${JSON.stringify(profile)}`.
  Cache hit → `{ ok:true, source:'gemini', cached:true, data }`.
- Build prompt → `callGeminiJson` → JSON.parse → `validateAdvice` → `{ ok:true, source:'gemini',
  cached:false, data, prompt, raw }`.
- If lang is 'hi' or 'te': one extra `callGeminiJson` with a short translation prompt translating
  `summary` + top 3 routine items (`"HH:MM — activity"` strings); attach
  `data.translated = { summary, topActions: [string,string,string] }`. If translation fails, set
  `translated = null` but still succeed.
- ANY failure (no key, HTTP error, bad JSON, schema fail) → `serverFallback(input)` →
  `{ ok:true, source:'fallback', cached:false, data, prompt, raw:null, error: <message> }`.
  Never return a 5xx for a valid request.
- Methods other than POST → 405. `GET /api/advise` health style is NOT needed (see /api/health).

### `api/chat.js` (Vercel function)
- `export default async function handler(req, res)`; POST `/api/chat`.
- Validate via `validateChatRequest` → 400 on invalid.
- NO caching (chat must be visibly dynamic).
- `buildChatPrompt` → `callGeminiJson`-like text call (same client, but temperature 0.9, NO
  responseMimeType) → `{ ok:true, source:'gemini', reply, prompt }`.
  - Add a `callGeminiText(prompt, temperature = 0.9)` export to `api/core/gemini.js`.
- Failure → rule-based reply string built from `aqiToRisk`/band of aqiNow.aqi: e.g.
  `"I couldn't reach the AI model right now. Rule-based answer: the AQI in ${name} is ${aqi}
  (${band}), so ${band advice sentence}. For health symptoms please consult a doctor."`
  → `{ ok:true, source:'fallback', reply, prompt, error: <message> }`.

### `api/health.js` (Vercel function)
- `export default async function handler(req, res)` → `{ ok:true, geminiConfigured:
  !!process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' }`.

### `server.js` (local dev API server, project root)
- Node http server on `127.0.0.1:8787` (port from `process.env.PORT || 8787`).
- Routes: POST `/api/advise`, POST `/api/chat`, GET `/api/health` — same behaviour by importing
  the `api/*` handlers is awkward (Vercel signature), so implement thin wrappers that call the same
  core logic. Best approach: put the real logic in `api/core/handlers.js` with
  `export async function handleAdvise(body)` / `handleChat(body)` / `handleHealth()` returning the
  response objects above; then `api/advise.js`, `api/chat.js`, `api/health.js` and `server.js`
  all delegate to it. (If you prefer another layout, keep the exported behaviours identical.)
- CORS: `Access-Control-Allow-Origin: *`, handle OPTIONS 204.
- Log each request: `[advise] source=gemini cached=0 city=Delhi`.

## 10. UI layer (`src/`)

### `src/context/AirwiseContext.jsx`
- `AirwiseProvider` + `useAirwise()` hook. State: `profile` (from storage), `city` (string|null),
  `air` (AirData|null), `airLoading`, `airError`, `lang`. Actions: `setCityAndLoad(name)`
  (geocode→fetchAirQuality, sets loading/error), `updateProfile(patch)`, `resetProfile()`,
  `setLang(l)` (persists). Export `useAirwise`.

### `src/components/`
- `CitySearch` — input + search button + results dropdown; validation errors shown inline
  (`City not found` for CITY_NOT_FOUND, friendly network message otherwise, empty-input error).
- `AqiCard` — big AQI number on band colour, band label chip, pollutant grid (PM2.5, PM10, NO₂,
  O₃, CO, SO₂ with units µg/m³ or mg/m³ for CO), updated time, source line
  `Data: Open-Meteo Air Quality API`.
- `ForecastChart` — recharts; X = hour (48 points), Line for `pm25` (µg/m³) + Line for `aqi`
  (secondary), ReferenceDots/labels for best and worst hour (from `bestHour`/`worstHour`); legend,
  responsive container, band colour reference banded background if easy. Mobile-friendly.
- `ProfileForm` — multi-section form (Household / Commute / Home / Outdoor) with validation
  (kids≥0, distance>0, mode/fuel enums), save via context, edit mode fills from profile.
- `RoutineList` — timeline of routine items (time pill + activity + reason).
- `HackCard` — tip + why + effort badge (low/med/high → green/amber/red).
- `SwapCard` — from→to, co2KgPerWeek, moneySavedPerMonth, exposureCutUgPerDay (from
  computedImpacts.swaps by id), why text.
- `ExposureMeter` — before vs after bar (recharts BarChart or two styled divs) with total µg,
  cut µg and cut %; sub-list by activity.
- `ChatBox` — messages list, input, send; shows `source` fallback notice; sample chips:
  `"Is it safe for my 5-year-old to play outside at 5 pm?"`,
  `"Should we keep windows open tonight?"`, `"Is my asthma medication plan affected today?"`.
- `PromptPanel` — disclosure/toggle showing the exact `prompt` sent and `raw` response (JSON
  pretty-printed) + `source`/`cached` badges. Used on Plan and Chat pages.
- `RiskBadge` — pill with band label + colour. `StatCard` — icon + number + caption.
- `Spinner`, `ErrorBanner`, `Section` (heading + children) — small shared components.
- `ShareCard` (F8) — community card: city, today AQI + band, top 3 routine actions, WhatsApp share
  link (`https://wa.me/?text=` + encoded text) + copy button; respects `lang` with a small built-in
  translation map (en/hi/te) for the static labels — fall back to English if missing.

### `src/pages/`
- `Onboarding` (`/onboarding`) — brand header, CitySearch, ProfileForm (wizard style optional);
  after save → navigate `/dashboard`. If profile already saved, show `Continue with saved profile`.
- `Dashboard` (`/dashboard`) — AqiCard + ForecastChart + best/worst hour chips + ShareCard +
  nav to Plan/Chat. Handles airLoading (skeleton) and airError (ErrorBanner with retry).
- `Plan` (`/plan`) — on mount POST `/api/advise` with `{ location, aqiNow: air.current,
  forecast24: air.hourly.slice(0,24), profile, computedImpacts: { swaps, exposure }, lang }`
  (compute swaps + exposure client-side via `computeAllSwaps`/`computeExposureSummary`);
  render summary + RiskBadge, RoutineList, indoor hacks, SwapCards, ExposureMeter, PromptPanel,
  translated summary when `data.translated`. Loading + fallback-source banner handled.
- `Chat` (`/chat`) — ChatBox wiring POST `/api/chat` with same grounded context + history.

### `src/App.jsx` (REPLACE the scaffold placeholder)
- Layout with top nav (logo, Onboarding/Dashboard/Plan/Chat links, language select en/hi/te),
  `<AirwiseProvider>` wrapping `<Routes>` for the 4 pages; 404 → redirect `/dashboard` when air
  loaded else `/onboarding`. Mobile responsive.

## 11. Tests (`tests/`, vitest, node env)

- `tests/aqiBands.test.js`: boundaries 50/51, 100/101, 200/201, 300/301, 400/401, 500, 999 clamp;
  aqiToRisk boundaries.
- `tests/impact.test.js` — hand-calc cases:
  - exposureUg(100, 60, 12) = 72; exposureUg(180, 45, 12.5, 3) = 303.8
  - commuteMinutes('metro', 8) = 16; commuteMinutes('walk', 8) = 96
  - indoorConc(200, 'lpg') = 160; indoorConc(200, 'wood') = 370
  - householdRate({adults:2,kids:1,elderly:0,pregnant:false}) = (24+10)/3 = 11.3
  - carToMetro numbers: profile car 8 km → co2 = 8×2×5×(171−14)/1000 = 12.6,
    money = 8×2×5×4×9 = 2880
  - computeAllSwaps with synthetic hourly (first 24 entries, pm25 80 at 07:00, 40 at 15:00) →
    walkShift cut = exposure(80)−exposure(40) for 45 min walk at householdRate
  - computeExposureSummary before ≥ after; applied ['carToMetro','walkShift'] reduces total.
- `tests/fallback.test.js`: shape passes validateAdvice; routine sorted by time; severe input
  (aqi 420) → risk_level 'severe' and mentions mask/windows closed.
- `tests/validate.test.js`: valid advice passes; missing summary / bad effort / bad risk fail with
  error strings; ProfileSchema accepts DEFAULT_PROFILE and rejects kids:-1.

## 12. Behaviour notes

- Numbers in UI always come from `impact.js` (deterministic) — Gemini only explains them.
- If `/api/advise` fetch itself fails in the browser (server down), the Plan page falls back to
  `fallbackAdvice(...)` client-side and shows a banner `Offline fallback (rule-based)`. So Plan
  page must import `fallbackAdvice` too.
- All user-facing numbers use `en-IN` locale formatting.
