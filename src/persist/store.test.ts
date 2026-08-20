import { describe, expect, it } from 'vitest'
import { analyzeAthlete } from '../domain/analyze.ts'
import { parseAthleteExport } from '../domain/parseAthlete.ts'
import { writeTemplateReport } from '../domain/templateWriter.ts'
import type { CombineSession } from '../domain/types.ts'
import {
  activeRecord,
  applyFileLists,
  rateAthlete,
  selectCombine,
  setDraft,
  setShareToken,
  signAthlete,
  unlockAthlete,
  upsertExports,
} from './store.ts'

function sessionWithLetter(): CombineSession {
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
  const record = {
    sourceName: 'FPL-0001/2026-07-14.json',
    export: exp,
    analysis,
    draft,
    letter: structuredClone(draft),
    status: 'draft' as const,
    generateMeta: {
      source: 'template' as const,
      model: 'template',
      promptVersion: 'forge-report-v3',
      generatedAt: '2026-08-20T00:00:00.000Z',
    },
  }
  return {
    version: 2 as const,
    coachName: 'Alex F',
    loadedAt: '2026-08-20T00:00:00.000Z',
    athletes: {
      'FPL-0001': {
        files: [{ tested_on: '2026-07-14', filename: '2026-07-14.json' }],
        active: '2026-07-14.json',
        records: { '2026-07-14.json': record },
      },
    },
  }
}

describe('coach rating', () => {
  it('stores a verdict on the letter without requiring a signature', () => {
    const next = rateAthlete(sessionWithLetter(), 'FPL-0001', 'edited')
    const record = activeRecord(next, 'FPL-0001')
    expect(record?.status).toBe('draft')
    expect(record?.coachRating?.verdict).toBe('edited')
    expect(record?.coachRating?.promptVersion).toBe('forge-report-v3')
    expect(record?.coachRating?.source).toBe('template')
  })

  it('lets them sign without a rating, and rate after lock', () => {
    const signed = signAthlete(sessionWithLetter(), 'FPL-0001')
    expect(activeRecord(signed, 'FPL-0001')?.status).toBe('signed')
    expect(activeRecord(signed, 'FPL-0001')?.coachRating).toBeUndefined()
    const rated = rateAthlete(signed, 'FPL-0001', 'ready')
    expect(activeRecord(rated, 'FPL-0001')?.status).toBe('signed')
    expect(activeRecord(rated, 'FPL-0001')?.coachRating?.verdict).toBe('ready')
  })

  it('can stamp a verdict at sign time', () => {
    const signed = signAthlete(sessionWithLetter(), 'FPL-0001', 'rewrite')
    expect(activeRecord(signed, 'FPL-0001')?.coachRating?.verdict).toBe('rewrite')
    expect(activeRecord(signed, 'FPL-0001')?.signedBy).toBe('Alex F')
  })

  it('clears the rating on unlock and on a new draft', () => {
    const rated = rateAthlete(sessionWithLetter(), 'FPL-0001', 'ready')
    const signed = signAthlete(rated, 'FPL-0001')
    const unlocked = unlockAthlete(signed, 'FPL-0001')
    expect(activeRecord(unlocked, 'FPL-0001')?.status).toBe('draft')
    expect(activeRecord(unlocked, 'FPL-0001')?.coachRating).toBeUndefined()

    const again = rateAthlete(unlocked, 'FPL-0001', 'edited')
    const record = activeRecord(again, 'FPL-0001')
    const regenerated = setDraft(
      again,
      'FPL-0001',
      record!.draft!,
      record!.letter!,
      record!.generateMeta,
    )
    expect(activeRecord(regenerated, 'FPL-0001')?.coachRating).toBeUndefined()
    expect(activeRecord(regenerated, 'FPL-0001')?.status).toBe('draft')
  })

  it('clears a share token on unlock', () => {
    const signed = signAthlete(sessionWithLetter(), 'FPL-0001')
    const shared = setShareToken(signed, 'FPL-0001', 'abcdefghijklmnopqr')
    expect(activeRecord(shared, 'FPL-0001')?.shareToken).toBe('abcdefghijklmnopqr')
    const unlocked = unlockAthlete(shared, 'FPL-0001')
    expect(activeRecord(unlocked, 'FPL-0001')?.shareToken).toBeUndefined()
  })

  it('does not rate a sheet with no letter', () => {
    const empty = sessionWithLetter()
    const id = 'FPL-0001'
    const record = activeRecord(empty, id)!
    empty.athletes[id]!.records['2026-07-14.json'] = { ...record, letter: undefined, draft: undefined, status: 'new' }
    expect(activeRecord(rateAthlete(empty, id, 'ready'), id)?.coachRating).toBeUndefined()
  })

  it('keeps a signed letter on one date when switching to another combine', () => {
    const first = signAthlete(sessionWithLetter(), 'FPL-0001')
    const later = parseAthleteExport({
      athlete: {
        name: 'Test Athlete',
        athlete_id: 'FPL-0001',
        age: 24,
        sex: 'F',
        sport: 'Volleyball',
        tested_on: '2026-08-01',
      },
      administration: {
        facility: 'Ridgeline Athletics',
        administered_by: 'M. Sandoval',
        conditions_note: '',
      },
      results: [{ subtest: 'sprint_40m', raw: 5.4, status: 'completed' }],
    })
    const withBoth = upsertExports(first, [
      {
        sourceName: 'FPL-0001/2026-08-01.json',
        export: later,
        files: [
          { tested_on: '2026-07-14', filename: '2026-07-14.json' },
          { tested_on: '2026-08-01', filename: '2026-08-01.json' },
        ],
      },
    ])
    expect(activeRecord(withBoth, 'FPL-0001')?.export.athlete.tested_on).toBe('2026-08-01')
    expect(activeRecord(withBoth, 'FPL-0001')?.status).toBe('new')
    const back = selectCombine(withBoth, 'FPL-0001', '2026-07-14.json')
    expect(activeRecord(back, 'FPL-0001')?.status).toBe('signed')
    expect(activeRecord(back, 'FPL-0001')?.export.athlete.tested_on).toBe('2026-07-14')
  })

  it('hydrates extra dates onto an athlete without dropping the active combine', () => {
    const start = sessionWithLetter()
    const next = applyFileLists(start, [
      {
        athlete_id: 'FPL-0001',
        files: [
          { tested_on: '2026-07-14', filename: '2026-07-14.json' },
          { tested_on: '2026-08-01', filename: '2026-08-01.json' },
        ],
      },
    ])
    expect(next.athletes['FPL-0001']?.files).toHaveLength(2)
    expect(next.athletes['FPL-0001']?.active).toBe('2026-07-14.json')
  })
})
