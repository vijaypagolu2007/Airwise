# AirWise — Urban Air Quality Assistant

GenAI assistant that helps families and communities get through winter smog.
It reads **live air quality** for your city, learns your **household and lifestyle**, and uses **Google Gemini** to plan a
low-exposure, low-emission day — with the **impact of every choice in numbers**.

Built for **Prompt Wars Virtual Challenge 6**. 100% free-tier stack.

## UI
Dashboard with a side menu (drawer on mobile), one screen per section: Overview, Forecast, Daily routine, Indoor hacks, Swaps & impact, Exposure meter, Ask AirWise, AI inspector, Profile & city.
Design system generated with [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (`design-system/MASTER.md`): Glassmorphism, sky + amber palette, Lora / Raleway, Phosphor icons, 4.5:1 contrast, visible focus, reduced-motion support.

## Features
| # | Feature | Where |
|---|---|---|
| 1 | City search + live AQI, PM2.5, PM10, NO₂, O₃, CO, SO₂ | Overview |
| 2 | 48-hour forecast chart (+ table view) with cleanest / worst hour | Forecast |
| 3 | Household & lifestyle profile (kids, elderly, asthma, commute, cooking fuel…) with validation | Profile |
| 4 | **AI daily low-emission routine** timed to the cleanest hours | Daily routine |
| 5 | **AI indoor air-quality hacks**, prioritised for the household's risk | Indoor hacks |
| 6 | **Sustainable swaps** with CO₂ saved, ₹ saved and PM2.5 dose cut | Swaps & impact |
| 7 | **Exposure meter**: inhaled PM2.5 before vs after the swaps you apply | Exposure meter |
| 8 | **Ask AirWise** chat grounded in today's data | Ask AI |
| 9 | Community card shared via WhatsApp, Hindi / Telugu translation | Overview, language menu |
| 10 | **AI inspector**: the exact prompt sent and Gemini's raw response | AI inspector, Ask AirWise |

## How GenAI is used
- AQI is India's **CPCB** index, computed in `src/lib/aqiBands.js` from PM2.5/PM10 (Open-Meteo gives concentrations; hourly values, so it is an estimate of the 24 h CPCB index). The risk badge comes from this band in code, not from the model.
- The server never trusts client numbers: it validates the profile, recomputes the AQI and every impact figure (`groundInput` in `api/_core/handlers.js`), fences all user text in the prompt and returns only coarse error codes.
- `POST /api/advise` sends Gemini one structured prompt: live AQI + 24 h forecast + profile + **code-computed impact numbers**.
  Gemini returns strict JSON (`summary`, `risk_level`, `routine`, `indoor_hacks`, `swaps`) validated with **zod**.
- `POST /api/chat` answers follow-up questions (temperature 0.9, uncached, so answers visibly change).
- Hindi / Telugu: a second Gemini call translates the summary and top actions.
- **Numbers never come from the AI.** Exposure, CO₂ and ₹ figures are computed in `src/lib/impact.js`; Gemini only explains them.
- **Never breaks:** no key, quota hit, timeout or invalid JSON → rule-based fallback (`src/lib/fallback.js`) in the same shape.

## Tech stack (all free)
React 19 + Vite 7 + Tailwind 4 · Phosphor icons · Recharts · zod · Gemini 2.5 Flash (Google AI Studio) · Open-Meteo Air Quality + Geocoding APIs (no key) · Vercel functions · localStorage

## Architecture
```
Browser (React)
  ├─ Open-Meteo Geocoding   → lat/lon
  ├─ Open-Meteo Air Quality → current + 48 h hourly
  ├─ src/lib/impact.js      → exposure, CO₂, ₹ (deterministic)
  └─ /api/advise, /api/chat → api/_core/handlers.js → Gemini → zod → UI
                                              └─ on any failure → rule-based fallback
```

## Run locally (Windows / macOS / Linux)
Requires Node 20+ and pnpm (`npm i -g pnpm`).
```bash
pnpm install
pnpm approve-builds          # allow esbuild
cp .env.example .env         # Windows: copy .env.example .env
# put your free key from https://aistudio.google.com/apikey into GEMINI_API_KEY
```
Two terminals:
```bash
pnpm run api    # API on http://127.0.0.1:8787
pnpm dev        # app on http://localhost:5173 (proxies /api)
```
Tests and build:
```bash
pnpm test       # 45 unit tests
pnpm build
```
Without a key the app still works in rule-based fallback mode (shown with an amber "Fallback" badge).

## Deploy (free) on Vercel
1. Push to GitHub, import the repo in Vercel (framework: Vite).
2. Add env var `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`).
3. Deploy. `api/*.js` become serverless functions; `api/_core` is shared code.

## Test cases for the demo
| Case | Input | Expected |
|---|---|---|
| Valid city | `Delhi` | Live AQI, forecast, plan |
| Compare city | `Hyderabad` | Different AQI → different plan |
| Invalid city | `asdfgh` | "City not found" |
| Empty input | (blank) | "Please type a city name." |
| Bad profile | Children `-1`, distance `0` | Inline field errors |
| Profile change | tick asthma + child, commute car | Stricter plan, car→metro swap with ₹ and CO₂ |
| Toggle swaps | un-apply "Walk at 15:00" | Exposure meter updates |
| AI failure | remove key / stop API server | Fallback banner, app keeps working |

## Impact model (src/lib/impact.js)
Inhaled dose (µg) = PM2.5 (µg/m³) × minutes × breathing rate (L/min) × activity factor / 1000.
Breathing rates: adult 12, child 10, elderly 11, pregnant 12.5 L/min. Indoor PM2.5 ≈ 0.6 × outdoor + cooking plume by fuel.
CO₂ per passenger-km: car 171 g, auto 105, bike 85, bus 60, metro 14. All assumptions are documented in the file.

## Project structure
```
api/            advise.js, chat.js, health.js (Vercel functions)
api/_core/      handlers, gemini client, prompts, cache, fallback
src/lib/        geocode, airApi, aqiBands, impact, fallback, validate, storage, apiClient
src/context/    AirwiseContext (global state)
src/hooks/      usePlan (shared AI plan + swaps + exposure)
src/components/ Layout (sidebar menu), Gates, AqiCard, ForecastChart, ProfileForm, RoutineList, HackCard, SwapCard, ExposureMeter, ChatBox, PromptPanel, ShareCard, ui
src/pages/      Overview, Forecast, Routine, Indoor, Swaps, Exposure, Chat, Inspector, Profile
design-system/  MASTER.md (UI UX Pro Max output + adaptations)
tests/          vitest unit tests
server.js       local API server
docs/CONTRACT.md module contract
```

_Not medical advice. Air data: Open-Meteo. AI: Google Gemini._
