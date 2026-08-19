import { SUBTEST_ORDER } from './benchmarks.ts'
import type { AthleteExport, RawResult, ResultStatus, Sex, SubtestId } from './types.ts'

const SUBTESTS = new Set<string>(SUBTEST_ORDER)

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ParseError(`Missing ${field}`)
  }
  return value.trim()
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ParseError(`Invalid ${field}`)
  }
  return value
}

function asSex(value: unknown): Sex {
  if (value === 'M' || value === 'F') return value
  throw new ParseError('athlete.sex must be M or F')
}

function asStatus(value: unknown): ResultStatus {
  if (value === 'completed' || value === 'skipped') return value
  throw new ParseError('result.status must be completed or skipped')
}

function asSubtest(value: unknown): SubtestId {
  if (typeof value === 'string' && SUBTESTS.has(value)) return value as SubtestId
  throw new ParseError(`Unknown subtest: ${String(value)}`)
}

function parseResult(value: unknown, index: number): RawResult {
  if (!isRecord(value)) throw new ParseError(`results[${index}] is not an object`)
  const status = asStatus(value.status)
  const raw = value.raw
  if (status === 'skipped') {
    if (raw !== null && raw !== undefined) {
      throw new ParseError(`${String(value.subtest)} is skipped but has a raw value`)
    }
  } else if (typeof raw !== 'number' || Number.isNaN(raw)) {
    throw new ParseError(`${String(value.subtest)} is completed but raw is not a number`)
  }
  const note = typeof value.note === 'string' && value.note.trim() ? value.note.trim() : undefined
  return {
    subtest: asSubtest(value.subtest),
    raw: status === 'skipped' ? null : (raw as number),
    status,
    ...(note ? { note } : {}),
  }
}

export function parseAthleteExport(input: unknown): AthleteExport {
  if (!isRecord(input)) throw new ParseError('File is not a JSON object')
  if (!isRecord(input.athlete)) throw new ParseError('Missing athlete')
  if (!isRecord(input.administration)) throw new ParseError('Missing administration')
  if (!Array.isArray(input.results)) throw new ParseError('Missing results array')

  const athlete = {
    name: asString(input.athlete.name, 'athlete.name'),
    athlete_id: asString(input.athlete.athlete_id, 'athlete.athlete_id'),
    age: asNumber(input.athlete.age, 'athlete.age'),
    sex: asSex(input.athlete.sex),
    sport: asString(input.athlete.sport, 'athlete.sport'),
    tested_on: asString(input.athlete.tested_on, 'athlete.tested_on'),
  }

  const administration = {
    facility: asString(input.administration.facility, 'administration.facility'),
    administered_by: asString(input.administration.administered_by, 'administration.administered_by'),
    conditions_note:
      typeof input.administration.conditions_note === 'string'
        ? input.administration.conditions_note.trim()
        : '',
  }

  const results = input.results.map(parseResult)
  const seen = new Set<string>()
  for (const result of results) {
    if (seen.has(result.subtest)) {
      throw new ParseError(`Duplicate subtest: ${result.subtest}`)
    }
    seen.add(result.subtest)
  }
  if (results.length === 0) throw new ParseError('results is empty')

  return { athlete, administration, results }
}

export async function parseAthleteFile(file: File): Promise<AthleteExport> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new ParseError(`${file.name} is not valid JSON`)
  }
  try {
    return parseAthleteExport(parsed)
  } catch (error) {
    if (error instanceof ParseError) {
      throw new ParseError(`${file.name}: ${error.message}`)
    }
    throw error
  }
}
