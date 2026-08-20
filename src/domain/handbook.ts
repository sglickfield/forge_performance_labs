import handbookFile from '../../data/forge_coach_handbook_2019_v1.json' with { type: 'json' }
import type { Sex, SubtestId } from './types.ts'

export interface HandbookRange {
  lo: number
  hi: number
}

export type Better = 'lower' | 'higher'

export interface HandbookMetric {
  id: string
  unit: string
  better: Better
  applies_to: SubtestId[]
}

export interface HandbookRangeRow {
  metric: string
  sex: Sex
  age_min: number
  age_max: number | null
  lo: number
  hi: number
}

export interface HandbookFile {
  edition: string
  typical_of?: string
  notes?: string[]
  metrics: HandbookMetric[]
  ranges: HandbookRangeRow[]
}

export interface AgeWindow {
  id: string
  min: number
  max: number | null
  label: string
}

export interface HandbookIndex {
  edition: string
  metrics: Map<string, HandbookMetric>
  subtestToMetric: Map<SubtestId, HandbookMetric>
  ranges: Map<string, HandbookRangeRow[]>
  ageWindows: AgeWindow[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Handbook: missing ${field}`)
  }
  return value.trim()
}

function asFinite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Handbook: invalid ${field}`)
  }
  return value
}

function asSex(value: unknown, field: string): Sex {
  if (value === 'M' || value === 'F') return value
  throw new Error(`Handbook: ${field} must be M or F`)
}

function asBetter(value: unknown, field: string): Better {
  if (value === 'lower' || value === 'higher') return value
  throw new Error(`Handbook: ${field} must be lower or higher`)
}

function asAgeMax(value: unknown, field: string): number | null {
  if (value === null) return null
  return asFinite(value, field)
}

function covers(age: number, min: number, max: number | null): boolean {
  return age >= min && (max === null || age <= max)
}

function windowsOverlap(
  a: { age_min: number; age_max: number | null },
  b: { age_min: number; age_max: number | null },
): boolean {
  const aEnd = a.age_max ?? Number.POSITIVE_INFINITY
  const bEnd = b.age_max ?? Number.POSITIVE_INFINITY
  return a.age_min <= bEnd && b.age_min <= aEnd
}

export function ageWindowId(min: number, max: number | null): string {
  return max === null ? `${min}_plus` : `${min}_${max}`
}

export function ageWindowLabel(min: number, max: number | null): string {
  return max === null ? `${min}+` : `${min}–${max}`
}

function parseMetric(value: unknown, index: number): HandbookMetric {
  if (!isRecord(value)) throw new Error(`Handbook: metrics[${index}] is not an object`)
  const applies = value.applies_to
  if (!Array.isArray(applies) || applies.length === 0) {
    throw new Error(`Handbook: metrics[${index}].applies_to must be a non-empty array`)
  }
  if (!applies.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error(`Handbook: metrics[${index}].applies_to must be strings`)
  }
  return {
    id: asString(value.id, `metrics[${index}].id`),
    unit: asString(value.unit, `metrics[${index}].unit`),
    better: asBetter(value.better, `metrics[${index}].better`),
    applies_to: applies as SubtestId[],
  }
}

function parseRange(value: unknown, index: number): HandbookRangeRow {
  if (!isRecord(value)) throw new Error(`Handbook: ranges[${index}] is not an object`)
  const lo = asFinite(value.lo, `ranges[${index}].lo`)
  const hi = asFinite(value.hi, `ranges[${index}].hi`)
  if (lo > hi) throw new Error(`Handbook: ranges[${index}] has lo > hi`)
  const ageMin = asFinite(value.age_min, `ranges[${index}].age_min`)
  const ageMax = asAgeMax(value.age_max, `ranges[${index}].age_max`)
  if (ageMax !== null && ageMax < ageMin) {
    throw new Error(`Handbook: ranges[${index}] has age_max < age_min`)
  }
  return {
    metric: asString(value.metric, `ranges[${index}].metric`),
    sex: asSex(value.sex, `ranges[${index}].sex`),
    age_min: ageMin,
    age_max: ageMax,
    lo,
    hi,
  }
}

/**
 * Validate and index a handbook file. Scoring looks up (metric, sex, age)
 * — it never reads column names like age_18_29.
 */
export function parseHandbook(input: unknown): HandbookIndex {
  if (!isRecord(input)) throw new Error('Handbook file is not an object')
  if (!Array.isArray(input.metrics) || input.metrics.length === 0) {
    throw new Error('Handbook: metrics must be a non-empty array')
  }
  if (!Array.isArray(input.ranges) || input.ranges.length === 0) {
    throw new Error('Handbook: ranges must be a non-empty array')
  }

  const metrics = new Map<string, HandbookMetric>()
  const subtestToMetric = new Map<SubtestId, HandbookMetric>()
  for (const [i, raw] of input.metrics.entries()) {
    const metric = parseMetric(raw, i)
    if (metrics.has(metric.id)) throw new Error(`Handbook: duplicate metric ${metric.id}`)
    metrics.set(metric.id, metric)
    for (const subtest of metric.applies_to) {
      if (subtestToMetric.has(subtest)) {
        throw new Error(`Handbook: subtest ${subtest} maps to more than one metric`)
      }
      subtestToMetric.set(subtest, metric)
    }
  }

  const ranges = new Map<string, HandbookRangeRow[]>()
  const windows = new Map<string, AgeWindow>()
  for (const [i, raw] of input.ranges.entries()) {
    const row = parseRange(raw, i)
    if (!metrics.has(row.metric)) {
      throw new Error(`Handbook: ranges[${i}] metric ${row.metric} is not in metrics`)
    }
    const key = `${row.metric}|${row.sex}`
    const list = ranges.get(key) ?? []
    for (const existing of list) {
      if (windowsOverlap(existing, row)) {
        throw new Error(
          `Handbook: overlapping age windows for ${row.metric} ${row.sex} (${row.age_min}–${row.age_max ?? '∞'})`,
        )
      }
    }
    list.push(row)
    ranges.set(key, list)

    const windowId = ageWindowId(row.age_min, row.age_max)
    const prev = windows.get(windowId)
    if (prev && (prev.min !== row.age_min || prev.max !== row.age_max)) {
      throw new Error(`Handbook: age window id ${windowId} is inconsistent`)
    }
    windows.set(windowId, {
      id: windowId,
      min: row.age_min,
      max: row.age_max,
      label: ageWindowLabel(row.age_min, row.age_max),
    })
  }

  for (const list of ranges.values()) {
    list.sort((a, b) => a.age_min - b.age_min)
  }

  const ageWindows = [...windows.values()].sort((a, b) => a.min - b.min)
  if (ageWindows.length === 0) throw new Error('Handbook: no age windows')

  return {
    edition: asString(input.edition, 'edition'),
    metrics,
    subtestToMetric,
    ranges,
    ageWindows,
  }
}

let cached: HandbookIndex | undefined

export function loadHandbook(file: unknown = handbookFile): HandbookIndex {
  cached = parseHandbook(file)
  return cached
}

export function getHandbook(): HandbookIndex {
  return cached ?? loadHandbook()
}

export function resetHandbookCache(): void {
  cached = undefined
}

export function metricForSubtest(
  subtest: SubtestId,
  handbook: HandbookIndex = getHandbook(),
): HandbookMetric | undefined {
  return handbook.subtestToMetric.get(subtest)
}

export function lookupRange(
  metric: string,
  sex: Sex,
  age: number,
  handbook: HandbookIndex = getHandbook(),
): HandbookRangeRow | undefined {
  const rows = handbook.ranges.get(`${metric}|${sex}`)
  if (!rows || rows.length === 0) return undefined
  const hit = rows.find((row) => covers(age, row.age_min, row.age_max))
  if (hit) return hit
  const youngest = rows[0]
  if (youngest && age < youngest.age_min) return youngest
  return undefined
}

export function handbookRange(
  subtest: SubtestId,
  sex: Sex,
  age: number,
  handbook: HandbookIndex = getHandbook(),
): HandbookRange | undefined {
  const metric = metricForSubtest(subtest, handbook)
  if (!metric) return undefined
  const row = lookupRange(metric.id, sex, age, handbook)
  if (!row) return undefined
  return { lo: row.lo, hi: row.hi }
}

export function handbookBetter(
  subtest: SubtestId,
  handbook: HandbookIndex = getHandbook(),
): Better | 'unknown' {
  return metricForSubtest(subtest, handbook)?.better ?? 'unknown'
}

export function handbookEdition(handbook: HandbookIndex = getHandbook()): string {
  return handbook.edition
}

export function ageBandFor(age: number, handbook: HandbookIndex = getHandbook()): string {
  const match =
    handbook.ageWindows.find((window) => covers(age, window.min, window.max)) ??
    handbook.ageWindows[0]
  if (!match) throw new Error('Handbook: no age windows loaded')
  return match.id
}

export function ageBandLabel(band: string, handbook: HandbookIndex = getHandbook()): string {
  const match = handbook.ageWindows.find((window) => window.id === band)
  if (match) return match.label
  if (band.endsWith('_plus')) return `${band.slice(0, -'_plus'.length)}+`
  return band.replace('_', '–')
}
