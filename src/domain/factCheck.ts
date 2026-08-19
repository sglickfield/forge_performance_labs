import { TEST_META } from './benchmarks.ts'
import type { Analysis, ReportDraft, SubtestId } from './types.ts'

export interface FactCheckIssue {
  code: string
  message: string
}

function draftText(draft: ReportDraft): string {
  return [
    draft.headline,
    draft.greeting,
    draft.what_we_saw,
    ...draft.keep_doing,
    ...draft.focus_next,
    ...draft.caveats,
    draft.signoff,
  ]
    .join('\n')
    .toLowerCase()
}

export function factCheck(analysis: Analysis, draft: ReportDraft): FactCheckIssue[] {
  const issues: FactCheckIssue[] = []
  const text = draftText(draft)

  if (!draft.headline.trim()) issues.push({ code: 'empty_headline', message: 'Headline is empty.' })
  if (!draft.what_we_saw.trim()) issues.push({ code: 'empty_body', message: '“What we saw” is empty.' })
  if (draft.keep_doing.filter((item) => item.trim()).length < 1) {
    issues.push({ code: 'empty_keep', message: 'Need at least one keep.' })
  }
  if (draft.focus_next.filter((item) => item.trim()).length < 1) {
    issues.push({ code: 'empty_focus', message: 'Need at least one focus.' })
  }
  if (!draft.coach_brief.trim()) {
    issues.push({ code: 'empty_brief', message: 'Coach brief is empty — the human needs a side note.' })
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
        message: `${meta.label} was skipped and the letter never says so.`,
      })
    }
    if (test.raw !== null) {
      issues.push({ code: 'skip_has_raw', message: `${meta.label} is skipped but analysis still has a raw.` })
    }
  }

  // Invented skipped-test numbers: if a skipped test's unit number shows up that is not another test's raw.
  const allowed = allowedNumbers(analysis)
  for (const test of skipped) {
    if (inventedMeasurement(text, test.subtest, allowed)) {
      issues.push({
        code: 'invented_skip_score',
        message: `Letter appears to invent a score for skipped ${TEST_META[test.subtest].label}.`,
      })
    }
  }

  const verify = analysis.flags.filter((flag) => flag.kind === 'verify_outlier')
  if (verify.length > 0) {
    const covered = draft.caveats.join(' ').toLowerCase()
    const brief = draft.coach_brief.toLowerCase()
    if (!/verif|check|mistime|outlier|unusual|question/i.test(`${covered}\n${brief}\n${text}`)) {
      issues.push({
        code: 'unmentioned_outlier',
        message: 'A verify-outlier flag never made it into the letter or coach brief.',
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
  // Only fire on explicit "<number> cm|s|kg" near jump language for jump skips.
  if (subtest !== 'vertical_jump_cm' && subtest !== 'broad_jump_cm') return false
  const jumpish = /jump/
  if (!jumpish.test(text)) return false
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
