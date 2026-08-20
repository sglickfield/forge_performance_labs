import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAthleteExport } from '../src/domain/parseAthlete.ts'
import type { AthleteExport } from '../src/domain/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_DIR = join(ROOT, 'data')
export const ATHLETES_DIR = join(DATA_DIR, 'athletes')
let athletesRoot = ATHLETES_DIR

export function setAthletesDir(dir: string = ATHLETES_DIR): void {
  athletesRoot = dir
}

const ID_OK = /^[A-Za-z0-9][A-Za-z0-9_-]{1,40}$/
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/

export interface StoredFile {
  tested_on: string
  filename: string
}

export interface AthleteSummary {
  athlete_id: string
  name: string
  sport: string
  files: StoredFile[]
  latest: string
}

function assertId(id: string): string {
  if (!ID_OK.test(id)) throw new Error(`Invalid athlete_id: ${id}`)
  return id
}

function athleteDir(id: string): string {
  return join(athletesRoot, assertId(id))
}

export class SaveConflictError extends Error {
  readonly identical: boolean
  readonly athlete_id: string
  readonly tested_on: string
  readonly athlete_name: string
  readonly filename: string

  constructor(fields: {
    identical: boolean
    athlete_id: string
    tested_on: string
    athlete_name: string
    filename: string
  }) {
    super('A file for this athlete and date already exists')
    this.name = 'SaveConflictError'
    this.identical = fields.identical
    this.athlete_id = fields.athlete_id
    this.tested_on = fields.tested_on
    this.athlete_name = fields.athlete_name
    this.filename = fields.filename
  }
}

export type SaveMode = 'new' | 'replace' | 'copy'

function canonicalName(testedOn: string): string {
  if (!DATE_OK.test(testedOn)) throw new Error(`Invalid tested_on: ${testedOn}`)
  return `${testedOn}.json`
}

function uniqueFilename(dir: string, testedOn: string): string {
  const base = canonicalName(testedOn)
  if (!existsSync(join(dir, base))) return base
  let n = 2
  while (existsSync(join(dir, `${testedOn}__${n}.json`))) n += 1
  return `${testedOn}__${n}.json`
}

function filesIn(dir: string): StoredFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((filename) => {
      const tested_on = filename.replace(/\.json$/, '').replace(/__\d+$/, '')
      return { tested_on, filename }
    })
    .sort((a, b) => a.filename.localeCompare(b.filename))
}

export function readExport(athleteId: string, filename: string): AthleteExport {
  if (!filename.endsWith('.json') || filename.includes('..') || filename.includes('/')) {
    throw new Error(`Invalid filename: ${filename}`)
  }
  const path = join(athleteDir(athleteId), filename)
  if (!existsSync(path)) throw new Error(`No file ${athleteId}/${filename}`)
  return parseAthleteExport(JSON.parse(readFileSync(path, 'utf8')))
}

function sameExport(a: AthleteExport, b: AthleteExport): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function saveExport(
  input: unknown,
  options: { mode?: SaveMode } = {},
): { athlete_id: string; filename: string; export: AthleteExport; action: 'created' | 'replaced' | 'copied' } {
  const exp = parseAthleteExport(input)
  const id = exp.athlete.athlete_id
  const dir = athleteDir(id)
  const canonical = canonicalName(exp.athlete.tested_on)
  const existingPath = join(dir, canonical)
  const exists = existsSync(existingPath)
  const mode = options.mode ?? 'new'

  if (exists && mode === 'new') {
    const previous = parseAthleteExport(JSON.parse(readFileSync(existingPath, 'utf8')))
    throw new SaveConflictError({
      identical: sameExport(previous, exp),
      athlete_id: id,
      tested_on: exp.athlete.tested_on,
      athlete_name: exp.athlete.name,
      filename: canonical,
    })
  }

  mkdirSync(dir, { recursive: true })
  const filename = mode === 'copy' && exists ? uniqueFilename(dir, exp.athlete.tested_on) : canonical
  writeFileSync(join(dir, filename), `${JSON.stringify(exp, null, 2)}\n`)
  const action = exists && mode === 'replace' ? 'replaced' : exists && mode === 'copy' ? 'copied' : 'created'
  return { athlete_id: id, filename, export: exp, action }
}

export function listSummaries(): AthleteSummary[] {
  if (!existsSync(athletesRoot)) return []
  const out: AthleteSummary[] = []
  for (const id of readdirSync(athletesRoot)) {
    const dir = join(athletesRoot, id)
    if (!statSync(dir).isDirectory()) continue
    const files = filesIn(dir)
    if (files.length === 0) continue
    const latest = files[files.length - 1]!
    const exp = readExport(id, latest.filename)
    out.push({
      athlete_id: id,
      name: exp.athlete.name,
      sport: exp.athlete.sport,
      files,
      latest: latest.filename,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Latest combine JSON per athlete — same set the desk loads. Tests must stay read-only. */
export function listLatestExports(): { sourceName: string; export: AthleteExport; files: StoredFile[] }[] {
  return listSummaries().map((row) => ({
    sourceName: `${row.athlete_id}/${row.latest}`,
    export: readExport(row.athlete_id, row.latest),
    files: row.files,
  }))
}

export function findLatestByName(name: string): AthleteExport {
  const row = listLatestExports().find((item) => item.export.athlete.name === name)
  if (!row) throw new Error(`No athlete named ${name}`)
  return row.export
}

export function findLatestById(athleteId: string): AthleteExport {
  const summary = listSummaries().find((row) => row.athlete_id === athleteId)
  if (!summary) throw new Error(`No athlete ${athleteId}`)
  return readExport(athleteId, summary.latest)
}
