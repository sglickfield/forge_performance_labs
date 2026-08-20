import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { publishShare, readShare, setShareRoot, unpublishShare } from '../../server/shareStore.ts'
import { analyzeAthlete } from './analyze.ts'
import { parseAthleteExport } from './parseAthlete.ts'
import {
  athleteSharePath,
  publicLetterFrom,
  shareTokenFromPath,
} from './share.ts'
import { writeTemplateReport } from './templateWriter.ts'
import type { AthleteRecord } from './types.ts'

function signedRecord(): AthleteRecord {
  const exp = parseAthleteExport({
    athlete: {
      name: 'Test Athlete',
      athlete_id: 'FPL-0001',
      age: 24,
      sex: 'F',
      sport: 'Volleyball',
      tested_on: '2026-07-14',
    },
    administration: {
      facility: 'Ridgeline Athletics',
      administered_by: 'M. Sandoval',
      conditions_note: '',
    },
    results: [
      { subtest: 'sprint_40m', raw: 5.5, status: 'completed' },
      { subtest: 'vertical_jump_cm', raw: null, status: 'skipped', note: 'ankle' },
    ],
  })
  const analysis = analyzeAthlete(exp)
  const draft = writeTemplateReport(analysis)
  return {
    sourceName: 'test.json',
    export: exp,
    analysis,
    draft,
    letter: draft,
    status: 'signed',
    signedAt: '2026-08-20T12:00:00.000Z',
    signedBy: 'Alex F',
  }
}

describe('share URL', () => {
  it('parses /a/<token> and ignores the desk path', () => {
    expect(shareTokenFromPath('/a/abcdefghijklmnopqr')).toBe('abcdefghijklmnopqr')
    expect(shareTokenFromPath('/')).toBeNull()
    expect(shareTokenFromPath('/a/short')).toBeNull()
    expect(athleteSharePath('abcdefghijklmnopqr')).toBe('/a/abcdefghijklmnopqr')
  })

  it('shares the signed letter without desk metadata', () => {
    const pub = publicLetterFrom(signedRecord())
    expect(pub.signedBy).toBe('Alex F')
    expect(pub.tests.length).toBeGreaterThan(0)
    expect(pub.letter.overview.length).toBeGreaterThan(0)
  })

  it('refuses to share an unsigned draft', () => {
    const record = signedRecord()
    record.status = 'draft'
    record.signedAt = undefined
    expect(() => publicLetterFrom(record)).toThrow(/signed/)
  })
})

describe('share store', () => {
  let dir = ''

  afterEach(() => {
    setShareRoot()
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('publishes, reuses the token, and round-trips the letter', () => {
    dir = mkdtempSync(join(tmpdir(), 'forge-share-'))
    setShareRoot(dir)
    const first = publishShare(publicLetterFrom(signedRecord()))
    const second = publishShare(publicLetterFrom(signedRecord()))
    expect(second.token).toBe(first.token)
    const loaded = readShare(first.token)
    expect(loaded.athlete.athlete_id).toBe('FPL-0001')
    unpublishShare(first.token)
    expect(() => readShare(first.token)).toThrow(/Not found/)
  })
})
