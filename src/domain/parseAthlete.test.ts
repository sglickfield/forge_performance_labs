import { describe, expect, it } from 'vitest'
import { ParseError, parseAthleteExport } from './parseAthlete'

const valid = {
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
}

describe('parseAthleteExport', () => {
  it('accepts a well-formed export', () => {
    const parsed = parseAthleteExport(valid)
    expect(parsed.athlete.athlete_id).toBe('FPL-0001')
    expect(parsed.results[1]?.status).toBe('skipped')
  })

  it('rejects completed tests without a number', () => {
    expect(() =>
      parseAthleteExport({
        ...valid,
        results: [{ subtest: 'sprint_40m', raw: null, status: 'completed' }],
      }),
    ).toThrow(ParseError)
  })

  it('rejects a tested_on that is not YYYY-MM-DD', () => {
    expect(() =>
      parseAthleteExport({
        ...valid,
        athlete: { ...valid.athlete, tested_on: 'July 14' },
      }),
    ).toThrow(/tested_on/)
  })

  it('rejects unknown subtests so a new combine file fails loudly', () => {
    expect(() =>
      parseAthleteExport({
        ...valid,
        results: [{ subtest: 'beep_test', raw: 10, status: 'completed' }],
      }),
    ).toThrow(/Unknown subtest/)
  })
})
