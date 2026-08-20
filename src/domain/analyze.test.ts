import { describe, expect, it } from 'vitest'
import { findLatestById, readExport } from '../../server/athleteStore.ts'
import { analyzeAthlete, sessionPullsFrom } from './analyze.ts'
import { factCheck } from './factCheck.ts'
import { writeTemplateReport } from './templateWriter.ts'

function load(id: string) {
  return findLatestById(id)
}

describe('analyzeAthlete', () => {
  it('bands Aisha against F 18–29 handbook ranges', () => {
    const analysis = analyzeAthlete(load('FPL-2429'))
    expect(analysis.ageBand).toBe('18_29')
    const sprint = analysis.tests.find((test) => test.subtest === 'sprint_40m')
    expect(sprint?.band).toBe('above')
    const vertical = analysis.tests.find((test) => test.subtest === 'vertical_jump_cm')
    expect(vertical?.band).toBe('above')
    const pull = analysis.tests.find((test) => test.subtest === 'midthigh_pull_n')
    expect(pull?.band).toBe('unbenchmarked')
  })

  it('marks Casey jumps skipped and never fabricates raw', () => {
    const analysis = analyzeAthlete(load('FPL-2145'))
    const jumps = analysis.tests.filter(
      (test) => test.subtest === 'vertical_jump_cm' || test.subtest === 'broad_jump_cm',
    )
    expect(jumps.every((test) => test.status === 'skipped' && test.raw === null)).toBe(true)
    expect(analysis.flags.some((flag) => flag.kind === 'skipped')).toBe(true)
    expect(analysis.flags.some((flag) => flag.kind === 'conditions')).toBe(true)
  })

  it('flags Taylor grip/balance splits and Sam sprint as verify', () => {
    const taylor = analyzeAthlete(load('FPL-2286'))
    expect(taylor.flags.some((flag) => flag.kind === 'asymmetry' && flag.text.includes('Grip'))).toBe(true)
    expect(taylor.flags.some((flag) => flag.kind === 'asymmetry' && flag.text.includes('Balance'))).toBe(true)

    const sam = analyzeAthlete(load('FPL-2401'))
    const sprintFlag = sam.flags.find(
      (flag) => flag.kind === 'verify_outlier' && flag.subtest === 'sprint_40m',
    )
    expect(sprintFlag).toBeTruthy()
  })

  it('ranks mid-thigh pull inside the loaded combine', () => {
    const batch = [
      readExport('FPL-2429', '2026-07-16.json'),
      readExport('FPL-2455', '2026-07-15.json'),
      readExport('FPL-2401', '2026-07-15.json'),
      readExport('FPL-2088', '2026-07-17.json'),
    ]
    const pulls = sessionPullsFrom(batch)
    const sam = analyzeAthlete(readExport('FPL-2401', '2026-07-15.json'), pulls)
    expect(sam.midthigh?.raw).toBe(3100)
    expect(sam.midthigh?.rank).toBe(1)
    expect(sam.midthigh?.of).toBe(4)
  })
})

describe('template + fact-check', () => {
  it('writes Aisha as a clustered report, not nine isolated scores', () => {
    const analysis = analyzeAthlete(load('FPL-2429'))
    const draft = writeTemplateReport(analysis)
    expect(factCheck(analysis, draft)).toEqual([])
    expect(draft.overview.toLowerCase()).toMatch(/handbook|typical range/)
    const takeawayText = draft.takeaways.map((section) => `${section.heading} ${section.body}`).join(' ')
    expect(takeawayText.toLowerCase()).toMatch(/sprint/)
    expect(takeawayText.toLowerCase()).toMatch(/jump/)
    expect(draft.recommendations.length).toBeGreaterThanOrEqual(3)
    expect(draft.recommendations.some((section) => /sprint|plyo|strength|re-?test/i.test(section.body))).toBe(true)
  })

  it('refuses to invent Casey jump scores and requires caveats', () => {
    const analysis = analyzeAthlete(load('FPL-2145'))
    const draft = writeTemplateReport(analysis)
    const issues = factCheck(analysis, draft)
    expect(issues).toEqual([])
    const letter = `${draft.overview} ${draft.caveats.join(' ')} ${draft.takeaways.map((s) => s.body).join(' ')}`.toLowerCase()
    expect(letter).toMatch(/jump|skipped|not tested|not collect/)
    expect(letter).not.toMatch(/vertical jump[^\n.]{0,40}\d+/)
  })

  it('catches a draft that invents Casey’s vertical', () => {
    const analysis = analyzeAthlete(load('FPL-2145'))
    const draft = writeTemplateReport(analysis)
    draft.overview += ' Vertical jump 44 cm was excellent.'
    const issues = factCheck(analysis, draft)
    expect(issues.some((issue) => issue.code === 'invented_skip_score')).toBe(true)
  })
})
