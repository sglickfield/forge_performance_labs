import { formatRaw } from './analyze.ts'
import { firstName } from './factCheck.ts'
import type { Analysis, ReportDraft, TestView } from './types.ts'

function describe(test: TestView): string {
  if (test.status === 'skipped' || test.raw === null) return `${test.label} was not tested`
  const score = formatRaw(test.raw, test.unit)
  if (test.band === 'above') return `${test.label} at ${score}, above typical for your group`
  if (test.band === 'below') return `${test.label} at ${score}, below the typical window`
  if (test.band === 'unbenchmarked') return `${test.label} at ${score}`
  return `${test.label} at ${score}, inside the typical window`
}

export function writeTemplateReport(analysis: Analysis, coachName: string): ReportDraft {
  const first = firstName(analysis.athlete.name)
  const sport = analysis.athlete.sport
  const completed = analysis.tests.filter((test) => test.status === 'completed' && test.raw !== null)
  const skipped = analysis.tests.filter((test) => test.status === 'skipped')
  const above = completed.filter((test) => test.band === 'above')
  const below = completed.filter((test) => test.band === 'below')

  const keep_doing = (analysis.keep.length ? analysis.keep : above.slice(0, 2)).map((test) => {
    if (test.band === 'above') {
      return `${test.label} — ${formatRaw(test.raw as number, test.unit)}. That's above the ${analysis.ageBandLabel} typical range. Worth protecting.`
    }
    return `${test.label} — ${formatRaw(test.raw as number, test.unit)}, solidly inside typical. Keep the work that's putting it there.`
  })

  const focus_next: string[] = []
  for (const test of analysis.focus) {
    if (test.status === 'skipped') {
      focus_next.push(`${test.label} was not collected this session. We'll pick it up when you're ready — no guess fills the hole.`)
      continue
    }
    if (test.band === 'below' && test.raw !== null) {
      focus_next.push(
        `${test.label} (${formatRaw(test.raw, test.unit)}) sat below typical for ${analysis.ageBandLabel} ${analysis.athlete.sex}. That's the lever I'd put at the top of the next block.`,
      )
      continue
    }
    if (test.note) {
      focus_next.push(`${test.label}: ${test.note} I'd rather retest than build a plan on a noisy trial.`)
    }
  }
  if (focus_next.length === 0 && below[0]?.raw !== null && below[0]) {
    focus_next.push(`${below[0].label} is the cleanest place to get better from this sheet.`)
  }
  if (focus_next.length === 0) {
    focus_next.push('Nothing here is a red flag. Next visit, we go after the same battery so we can see change, not just a snapshot.')
  }

  const caveats = analysis.flags
    .filter((flag) => flag.kind === 'skipped' || flag.kind === 'quality' || flag.kind === 'verify_outlier' || flag.kind === 'conditions' || flag.kind === 'asymmetry')
    .map((flag) => flag.text)

  const pullLine = analysis.midthigh
    ? ` Mid-thigh pull was ${formatRaw(analysis.midthigh.raw, 'N')} — no handbook range exists; among this week's completed pulls that ranks ${analysis.midthigh.rank} of ${analysis.midthigh.of}.`
    : ''

  const opener =
    skipped.length > 0
      ? `${first}, we did not collect a full battery — ${skipped.map((test) => test.label.toLowerCase()).join(' and ')} came off the sheet.`
      : `${first}, this is the letter from your ${analysis.administration.facility} combine on ${formatDate(analysis.athlete.tested_on)}.`

  const bodyParts = [
    opener,
    completed.length
      ? `Against the 2019 handbook ranges for ${analysis.ageBandLabel} / ${analysis.athlete.sex}, ${summarizeBands(above.length, below.length, completed.length)} ${sport.toLowerCase()} is the context I read it in.`
      : '',
    above[0] ? `The number that jumps first: ${describe(above[0])}.` : '',
    below[0] ? `The one I'd put a pin in: ${describe(below[0])}.` : '',
    pullLine.trim(),
  ].filter(Boolean)

  const headline = headlineFor(analysis, first)
  const coach_brief = coachBrief(analysis, coachName)

  return {
    headline,
    greeting: `${first} —`,
    what_we_saw: bodyParts.join(' '),
    keep_doing: keep_doing.slice(0, 3),
    focus_next: focus_next.slice(0, 3),
    caveats,
    signoff: 'We will use the next session to see what moved, not to admire the snapshot.',
    coach_brief,
  }
}

function summarizeBands(above: number, below: number, completed: number): string {
  if (above && !below) return `${above} of ${completed} completed tests sat above typical.`
  if (below && !above) return `${below} of ${completed} completed tests sat below typical.`
  if (above && below) return `${above} tests sat above typical and ${below} sat below.`
  return `all ${completed} completed tests landed inside typical.`
}

function headlineFor(analysis: Analysis, first: string): string {
  const skipped = analysis.tests.some((test) => test.status === 'skipped')
  const verify = analysis.flags.some((flag) => flag.kind === 'verify_outlier')
  const split = analysis.flags.some((flag) => flag.kind === 'asymmetry')
  if (skipped) return `${first}: partial battery — letter written around what we actually measured`
  if (verify) return `${first}: strong sheet, one number I would verify before we build on it`
  if (split) return `${first}: the story this week is the left/right split, not the averages`
  const top = analysis.keep[0]
  if (top?.raw !== null && top) {
    return `${first}: ${top.label.toLowerCase()} is the headline (${formatRaw(top.raw, top.unit)})`
  }
  return `${first}: a clean combine snapshot`
}

function coachBrief(analysis: Analysis, coachName: string): string {
  const bits: string[] = []
  const who = coachName.trim() ? `${coachName.trim()}: ` : ''
  if (analysis.flags.some((flag) => flag.kind === 'skipped')) {
    bits.push('Do not let a draft invent jump (or any) scores. The caveats are load-bearing.')
  }
  if (analysis.flags.some((flag) => flag.kind === 'verify_outlier')) {
    bits.push('There is a verify-outlier on this sheet. Ask the tester about timing / setup before the athlete internalizes that number.')
  }
  if (analysis.flags.some((flag) => flag.kind === 'asymmetry')) {
    bits.push('Call the L/R split in your own words. The athlete will notice if you smooth it over.')
  }
  if (analysis.flags.some((flag) => flag.kind === 'quality')) {
    bits.push('A tester marked a quality issue. I would rather retest than program off it.')
  }
  if (analysis.midthigh) {
    bits.push('No handbook range for mid-thigh pull — I used within-week rank only.')
  }
  if (bits.length === 0) {
    bits.push('Clean sheet. Light edit, then sign. Nothing here needs a phone call.')
  }
  return who + bits.join(' ')
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
