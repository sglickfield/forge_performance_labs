import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SHARE_TOKEN_PATTERN, type PublicLetter, type SharedLetter } from '../src/domain/share.ts'
import { DATA_DIR } from './athleteStore.ts'

const DEFAULT_SHARE_DIR = join(DATA_DIR, 'share')
let shareRoot = DEFAULT_SHARE_DIR

export function setShareRoot(dir: string = DEFAULT_SHARE_DIR): void {
  shareRoot = dir
}

function assertToken(token: string): string {
  if (!SHARE_TOKEN_PATTERN.test(token)) throw new Error('Invalid share token')
  return token
}

function fileFor(token: string): string {
  return join(shareRoot, `${assertToken(token)}.json`)
}

function newToken(): string {
  return randomBytes(18).toString('base64url')
}

function listedTokens(): string[] {
  if (!existsSync(shareRoot)) return []
  return readdirSync(shareRoot)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .filter((token) => SHARE_TOKEN_PATTERN.test(token))
}

function findExistingToken(athleteId: string, testedOn: string): string | undefined {
  for (const token of listedTokens()) {
    try {
      const row = readShare(token)
      if (row.athlete.athlete_id === athleteId && row.athlete.tested_on === testedOn) return token
    } catch {
      // skip unreadable files
    }
  }
  return undefined
}

export function publishShare(input: PublicLetter): SharedLetter {
  if (!input.signedAt || !input.signedBy.trim()) throw new Error('Share requires a signed letter')
  mkdirSync(shareRoot, { recursive: true })
  const token = findExistingToken(input.athlete.athlete_id, input.athlete.tested_on) ?? newToken()
  const shared: SharedLetter = {
    ...input,
    letter: { ...input.letter, coach_brief: '' },
    token,
  }
  writeFileSync(fileFor(token), `${JSON.stringify(shared, null, 2)}\n`)
  return shared
}

export function readShare(token: string): SharedLetter {
  const path = fileFor(token)
  if (!existsSync(path)) throw new Error('Not found')
  const raw = JSON.parse(readFileSync(path, 'utf8')) as SharedLetter
  if (!raw?.athlete?.athlete_id || !raw.letter?.overview || !raw.signedBy) {
    throw new Error('Not found')
  }
  return { ...raw, letter: { ...raw.letter, coach_brief: '' }, token }
}

export function unpublishShare(token: string): void {
  const path = fileFor(token)
  if (existsSync(path)) rmSync(path)
}
