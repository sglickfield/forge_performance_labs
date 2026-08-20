import { TEST_META } from './subtests.ts'
import type { Analysis, ReportDraft, SubtestId } from './types.ts'

export interface FactCheckIssue {
  code: string
  message: string
}

function draftText(draft: ReportDraft): string {
  return [
    draft.headline,
    draft.overview,
    ...draft.takeaways.flatMap((section) => [section.heading, section.body]),
    ...draft.recommendations.flatMap((section) => [section.heading, section.body]),
    ...draft.caveats,
  ]
    .join('\n')
    .toLowerCase()
}

export function factCheck(analysis: Analysis, draft: ReportDraft): FactCheckIssue[] {
  const issues: FactCheckIssue[] = []
  const text = draftText(draft)

  if (!draft.headline.trim()) issues.push({ code: 'empty_headline', message: 'Headline is empty.' })
  if (!draft.overview.trim()) issues.push({ code: 'empty_body', message: 'Overview is empty.' })
  if (draft.takeaways.filter((section) => section.body.trim()).length < 1) {
    issues.push({ code: 'empty_keep', message: 'Need at least one takeaway.' })
  }
  if (draft.recommendations.filter((section) => section.body.trim()).length < 1) {
    issues.push({ code: 'empty_focus', message: 'Need at least one recommendation.' })
  }
  const skipped = analysis.tests.filter((test) => test.status === 'skipped')
  if (skipped.length > 0 && draft.caveats.every((item) => !item.trim())) {
    issues.push({ code: 'missing_skip_caveat', message: 'Skipped tests must appear in caveats.' })
  }

  for (const test of skipped) {
    const meta = TEST_META[test.subtest]
    const mentioned = text.includes(meta.short) || text.includes(meta.label.toLowerCase()) || text.includes('jump')
    if (!mentioned && (test.subtest === 'vertical_jump_cm' || test.subtest === 'broad_jump_cm')) {
      issues.push({
        code: 'unmentioned_skip',
        message: `${meta.label} was skipped and the report never says so.`,
      })
    }
    if (test.raw !== null) {
      issues.push({ code: 'skip_has_raw', message: `${meta.label} is skipped but analysis still has a raw.` })
    }
  }

  const allowed = allowedNumbers(analysis)
  for (const test of skipped) {
    if (inventedMeasurement(text, test.subtest, allowed)) {
      issues.push({
        code: 'invented_skip_score',
        message: `Report appears to invent a score for skipped ${TEST_META[test.subtest].label}.`,
      })
    }
  }

  const verify = analysis.flags.filter((flag) => flag.kind === 'verify_outlier')
  if (verify.length > 0) {
    if (!/verif|check|mistime|outlier|unusual|question/i.test(text)) {
      issues.push({
        code: 'unmentioned_outlier',
        message: 'A verify-outlier flag never made it into the report.',
      })
    }
  }

  return issues
}

function allowedNumbers(analysis: Analysis): Set<string> {
  const out = new Set<string>()
  const add = (n: number) => {
    out.add(String(n))
    out.add(n.toFixed(1))
    out.add(n.toFixed(2))
    out.add(String(Math.round(n)))
  }
  add(analysis.athlete.age)
  for (const test of analysis.tests) {
    if (test.raw !== null) add(test.raw)
    if (test.range) {
      add(test.range.lo)
      add(test.range.hi)
    }
  }
  if (analysis.midthigh) {
    add(analysis.midthigh.raw)
    add(analysis.midthigh.rank)
    add(analysis.midthigh.of)
  }
  return out
}

function inventedMeasurement(text: string, subtest: SubtestId, allowed: Set<string>): boolean {
  if (subtest !== 'vertical_jump_cm' && subtest !== 'broad_jump_cm') return false
  if (!/jump/.test(text)) return false
  const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*(cm|s|sec)/g)
  for (const match of matches) {
    const n = match[1]
    if (!allowed.has(n) && !allowed.has(Number(n).toFixed(1))) {
      return true
    }
  }
  return false
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name
}
