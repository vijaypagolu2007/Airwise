// @ts-check
// AirWise zod schemas (shared by browser and API). Binding contract: docs/CONTRACT.md §7.
import { z } from 'zod'
import { COMMUTE_MODES, FUELS, LANGUAGES, SWAP_IDS } from './defaults.js'

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM')
const nonNegInt = z.number().int().min(0)

export const ProfileSchema = z.object({
  city: z.string().max(100),
  household: z.object({
    adults: nonNegInt,
    kids: nonNegInt,
    elderly: nonNegInt,
    pregnant: z.boolean(),
    asthma: z.boolean(),
    copd: z.boolean(),
    heart: z.boolean(),
  }),
  commute: z.object({
    mode: z.enum(COMMUTE_MODES),
    distanceKm: z.number().min(0),
    time: hhmm,
  }),
  home: z.object({
    fuel: z.enum(FUELS),
    purifier: z.boolean(),
    plants: nonNegInt,
    ac: z.boolean(),
  }),
  outdoor: z.object({
    walk: z.boolean(),
    walkTime: hhmm,
    sports: z.boolean(),
    sportsTime: hhmm,
    schoolRun: z.boolean(),
    schoolRunTime: hhmm,
  }),
  language: z.enum(LANGUAGES),
})

export const AdviceSchema = z.object({
  summary: z.string().min(1),
  risk_level: z.enum(['low', 'moderate', 'high', 'severe']),
  routine: z
    .array(z.object({ time: z.string().min(1), activity: z.string().min(1), reason: z.string().min(1) }))
    .max(12),
  indoor_hacks: z
    .array(z.object({ tip: z.string().min(1), why: z.string().min(1), effort: z.enum(['low', 'med', 'high']) }))
    .max(8),
  swaps: z
    .array(z.object({ id: z.enum(SWAP_IDS), from: z.string().min(1), to: z.string().min(1), impact_explained: z.string().min(1) }))
    .max(6),
  translated: z
    .object({ summary: z.string().min(1), topActions: z.array(z.string().min(1)).min(1).max(3) })
    .optional(),
})

const LocationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  admin1: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})
const AqiNowSchema = z.object({
  aqi: z.number(),
  pm25: z.number(),
  pm10: z.number().nullable().optional(),
  no2: z.number().nullable().optional(),
  o3: z.number().nullable().optional(),
  co: z.number().nullable().optional(),
  so2: z.number().nullable().optional(),
  time: z.string().optional(),
})
const Forecast24Schema = z
  .array(
    z.object({
      time: z.string().min(1),
      aqi: z.number().nullable(),
      pm25: z.number().nullable(),
      pm10: z.number().nullable().optional(),
      no2: z.number().nullable().optional(),
    }),
  )
  .min(1)
  .max(48)

export const AdviseRequestSchema = z.object({
  location: LocationSchema,
  aqiNow: AqiNowSchema,
  forecast24: Forecast24Schema,
  // Impact numbers are never taken from the client: the server recomputes them (api/_core/handlers.js).
  profile: ProfileSchema,
  lang: z.enum(LANGUAGES).optional(),
})

export const ChatRequestSchema = z.object({
  location: LocationSchema,
  aqiNow: AqiNowSchema,
  forecast24: Forecast24Schema,
  profile: ProfileSchema,
  question: z.string().trim().min(1, 'question is empty').max(1000),
  history: z
    .array(z.object({ role: z.enum(['user', 'model']), content: z.string().max(2000) }))
    .max(12)
    .optional(),
})

/**
 * @template {z.ZodType} S
 * @param {S} schema
 * @param {unknown} json
 * @returns {{ ok: true, data: z.infer<S> } | { ok: false, errors: string[] }}
 */
function run(schema, json) {
  const r = schema.safeParse(json)
  if (r.success) return { ok: true, data: r.data }
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  }
}

/** @param {unknown} json */
export const validateProfile = (json) => run(ProfileSchema, json)
/** @param {unknown} json */
export const validateAdvice = (json) => run(AdviceSchema, json)
/** @param {unknown} json */
export const validateAdviseRequest = (json) => run(AdviseRequestSchema, json)
/** @param {unknown} json */
export const validateChatRequest = (json) => run(ChatRequestSchema, json)
