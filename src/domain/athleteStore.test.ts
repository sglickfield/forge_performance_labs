import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { saveExport, SaveConflictError, setAthletesDir } from '../../server/athleteStore.ts'

const sample = {
  athlete: {
    name: 'New Athlete',
    athlete_id: 'FPL-9999',
    age: 22,
    sex: 'F' as const,
    sport: 'Soccer',
    tested_on: '2026-08-01',
  },
  administration: {
    facility: 'Ridgeline Athletics',
    administered_by: 'M. Sandoval',
    conditions_note: '',
  },
  results: [{ subtest: 'sprint_40m', raw: 5.5, status: 'completed' as const }],
}

describe('saveExport', () => {
  let dir = ''

  afterEach(() => {
    setAthletesDir()
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('creates a new athlete folder and canonical date file', () => {
    dir = mkdtempSync(join(tmpdir(), 'forge-athletes-'))
    setAthletesDir(dir)
    const saved = saveExport(sample)
    expect(saved.action).toBe('created')
    expect(saved.filename).toBe('2026-08-01.json')
    const written = JSON.parse(readFileSync(join(dir, 'FPL-9999', '2026-08-01.json'), 'utf8'))
    expect(written.athlete.athlete_id).toBe('FPL-9999')
  })

  it('conflicts when the same date file already exists', () => {
    dir = mkdtempSync(join(tmpdir(), 'forge-athletes-'))
    setAthletesDir(dir)
    saveExport(sample)
    expect(() => saveExport(sample)).toThrow(SaveConflictError)
    try {
      saveExport(sample)
    } catch (error) {
      expect(error).toBeInstanceOf(SaveConflictError)
      expect((error as SaveConflictError).identical).toBe(true)
    }
    const changed = {
      ...sample,
      results: [{ subtest: 'sprint_40m', raw: 5.1, status: 'completed' as const }],
    }
    try {
      saveExport(changed)
    } catch (error) {
      expect((error as SaveConflictError).identical).toBe(false)
    }
  })

  it('replaces or copies on request', () => {
    dir = mkdtempSync(join(tmpdir(), 'forge-athletes-'))
    setAthletesDir(dir)
    saveExport(sample)
    const replaced = saveExport(
      { ...sample, results: [{ subtest: 'sprint_40m', raw: 5.1, status: 'completed' }] },
      { mode: 'replace' },
    )
    expect(replaced.action).toBe('replaced')
    expect(replaced.filename).toBe('2026-08-01.json')
    const copied = saveExport(sample, { mode: 'copy' })
    expect(copied.action).toBe('copied')
    expect(copied.filename).toBe('2026-08-01__2.json')
  })
})
