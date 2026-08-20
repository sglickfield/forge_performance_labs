import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAthleteExport } from '../src/domain/parseAthlete.ts'
import type { AthleteExport } from '../src/domain/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_DIR = join(ROOT, 'data')
export const ATHLETES_DIR = join(DATA_DIR, 'athletes')

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
  return join(ATHLETES_DIR, assertId(id))
}

function uniqueFilename(dir: string, testedOn: string): string {
  if (!DATE_OK.test(testedOn)) throw new Error(`Invalid tested_on: ${testedOn}`)
  const base = `${testedOn}.json`
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

export function saveExport(input: unknown): { athlete_id: string; filename: string; export: AthleteExport } {
  const exp = parseAthleteExport(input)
  const id = exp.athlete.athlete_id
  const dir = athleteDir(id)
  mkdirSync(dir, { recursive: true })
  const filename = uniqueFilename(dir, exp.athlete.tested_on)
  writeFileSync(join(dir, filename), `${JSON.stringify(exp, null, 2)}\n`)
  return { athlete_id: id, filename, export: exp }
}

export function listSummaries(): AthleteSummary[] {
  if (!existsSync(ATHLETES_DIR)) return []
  const out: AthleteSummary[] = []
  for (const id of readdirSync(ATHLETES_DIR)) {
    const dir = join(ATHLETES_DIR, id)
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
export function listLatestExports(): { sourceName: string; export: AthleteExport }[] {
  return listSummaries().map((row) => ({
    sourceName: `${row.athlete_id}/${row.latest}`,
    export: readExport(row.athlete_id, row.latest),
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
