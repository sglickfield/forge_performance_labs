import { describe, expect, it } from 'vitest'
import handbookFile from '../../data/forge_coach_handbook_2019_v1.json' with { type: 'json' }
import {
  ageBandFor,
  ageBandLabel,
  handbookBetter,
  handbookRange,
  lookupRange,
  parseHandbook,
} from './handbook.ts'
import { SUBTEST_ORDER } from './subtests.ts'

const handbook = parseHandbook(handbookFile)

describe('parseHandbook', () => {
  it('loads long-form ranges, not wide age columns', () => {
    expect(handbook.edition).toMatch(/2019/)
    expect(handbook.metrics.size).toBe(6)
    expect(handbook.ageWindows.map((window) => window.id)).toEqual(['18_29', '30_39', '40_plus'])
  })

  it('maps laterality onto shared metrics', () => {
    expect(handbook.subtestToMetric.get('grip_strength_left_kg')?.id).toBe('grip_strength_kg')
    expect(handbook.subtestToMetric.get('grip_strength_right_kg')?.id).toBe('grip_strength_kg')
    expect(handbook.subtestToMetric.get('balance_left_s')?.id).toBe('balance_s')
    expect(handbook.subtestToMetric.get('midthigh_pull_n')).toBeUndefined()
  })

  it('only aliases real combine subtests', () => {
    for (const metric of handbook.metrics.values()) {
      for (const subtest of metric.applies_to) {
        expect(SUBTEST_ORDER).toContain(subtest)
      }
    }
  })

  it('rejects overlapping age windows', () => {
    expect(() =>
      parseHandbook({
        edition: 'test',
        metrics: [{ id: 'sprint_40m', unit: 's', better: 'lower', applies_to: ['sprint_40m'] }],
        ranges: [
          { metric: 'sprint_40m', sex: 'F', age_min: 18, age_max: 29, lo: 5.3, hi: 6.3 },
          { metric: 'sprint_40m', sex: 'F', age_min: 25, age_max: 40, lo: 5.4, hi: 6.4 },
        ],
      }),
    ).toThrow(/overlap/)
  })
})

describe('lookup is (metric, sex, age)', () => {
  it('scores Aisha-shaped F 24 sprint without an age-band column name', () => {
    const sprint = lookupRange('sprint_40m', 'F', 24, handbook)
    expect(sprint).toMatchObject({ lo: 5.3, hi: 6.3 })
    expect(handbookRange('sprint_40m', 'F', 24, handbook)).toEqual({ lo: 5.3, hi: 6.3 })
    expect(handbookBetter('sprint_40m', handbook)).toBe('lower')
  })

  it('uses the open-ended 40+ window and shared grip metric', () => {
    expect(lookupRange('sprint_40m', 'M', 47, handbook)).toMatchObject({ lo: 5.1, hi: 6.1 })
    expect(handbookRange('grip_strength_left_kg', 'F', 22, handbook)).toEqual({ lo: 25, hi: 36 })
    expect(handbookRange('grip_strength_right_kg', 'F', 22, handbook)).toEqual({ lo: 25, hi: 36 })
  })

  it('does not invent a mid-thigh pull range', () => {
    expect(handbookRange('midthigh_pull_n', 'M', 28, handbook)).toBeUndefined()
    expect(handbookBetter('midthigh_pull_n', handbook)).toBe('unknown')
  })

  it('clamps under-18 onto the youngest window', () => {
    expect(ageBandFor(16, handbook)).toBe('18_29')
    expect(lookupRange('vertical_jump_cm', 'F', 16, handbook)).toMatchObject({ lo: 31, hi: 47 })
  })

  it('labels bands from the file', () => {
    expect(ageBandLabel(ageBandFor(24, handbook), handbook)).toBe('18–29')
    expect(ageBandLabel(ageBandFor(40, handbook), handbook)).toBe('40+')
  })
})
