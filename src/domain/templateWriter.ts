import { formatRaw, firstName } from './format.ts'
import { ratingLabel } from './bandLabels.ts'
import type { Analysis, ReportDraft, ReportSection, TestView } from './types.ts'

const SPEED_POWER = new Set(['sprint_40m', 'vertical_jump_cm', 'broad_jump_cm'])
const SUPPORT = new Set([
  'grip_strength_left_kg',
  'grip_strength_right_kg',
  'sit_reach_cm',
  'balance_left_s',
  'balance_right_s',
])

export function writeTemplateReport(analysis: Analysis): ReportDraft {
  const first = firstName(analysis.athlete.name)
  const completed = analysis.tests.filter((test) => test.status === 'completed' && test.raw !== null)
  const skipped = analysis.tests.filter((test) => test.status === 'skipped')
  const speed = completed.filter((test) => SPEED_POWER.has(test.subtest))
  const support = completed.filter((test) => SUPPORT.has(test.subtest))
  const superiorSpeed = speed.filter((test) => test.band === 'above')
  const weakSupport = support.filter((test) => test.band === 'below')
  const sexWord = analysis.athlete.sex === 'F' ? 'female' : 'male'
  const handbook =
    `typical ranges published for recreational-to-competitive ${sexWord} athletes aged ${analysis.ageBandLabel} (Forge Coach Handbook, 2019, Appendix C)`

  const overview = skipped.length
    ? `${first} completed a partial combine at ${analysis.administration.facility} on ${formatDate(analysis.athlete.tested_on)}. ${skipped.map((test) => test.label).join(' and ')} ${skipped.length === 1 ? 'was' : 'were'} not tested${skipReason(skipped)}. Results that we do have are compared against ${handbook}. Those ranges describe common performance bands, not elite standards.`
    : `${first} completed a full battery of field tests — sprint speed, lower-body power, grip, isometric strength, flexibility, and single-leg balance. Results are compared against ${handbook}. Those ranges describe common performance bands rather than elite standards; scores outside the band in the useful direction are marked Superior.`

  const takeaways = buildTakeaways(analysis, first, superiorSpeed, speed, support, weakSupport, skipped)
  const recommendations = buildRecommendations(analysis, first, superiorSpeed, weakSupport, skipped)

  return {
    headline: headlineFor(analysis, first, superiorSpeed, skipped),
    overview,
    takeaways,
    recommendations,
    caveats: caveatsFor(analysis),
  }
}

function skipReason(skipped: TestView[]): string {
  const note = skipped.map((test) => test.note).find((item) => item && !/^see /i.test(item))
  return note ? ` (${note.replace(/\.$/, '')})` : ''
}

function headlineFor(analysis: Analysis, first: string, superiorSpeed: TestView[], skipped: TestView[]): string {
  if (skipped.some((test) => SPEED_POWER.has(test.subtest))) {
    return `Partial battery — report written around what we actually measured`
  }
  if (analysis.flags.some((flag) => flag.kind === 'verify_outlier')) {
    return `Strong sheet, one number I would verify before we build on it`
  }
  if (analysis.flags.some((flag) => flag.kind === 'asymmetry')) {
    return `The story this week is the left/right split, not the averages`
  }
  if (superiorSpeed.length >= 2) {
    return `Standout explosive speed and power`
  }
  if (superiorSpeed.length === 1 && superiorSpeed[0]) {
    return `${superiorSpeed[0].label} is the headline`
  }
  return `${first}: a clean combine snapshot`
}

function buildTakeaways(
  analysis: Analysis,
  first: string,
  superiorSpeed: TestView[],
  speed: TestView[],
  support: TestView[],
  weakSupport: TestView[],
  skipped: TestView[],
): ReportSection[] {
  const out: ReportSection[] = []

  if (superiorSpeed.length >= 2) {
    const bits = superiorSpeed.map((test) => `${test.label.toLowerCase()} (${formatRaw(test.raw as number, test.unit)})`)
    out.push({
      heading: 'Standout strengths — explosive speed and power',
      body: `${first}'s ${joinAnd(bits)} all sit above the typical range for her age and sex. These metrics are highly relevant to ${analysis.athlete.sport.toLowerCase()} and indicate excellent reactive strength and acceleration capacity relative to the recreational-to-competitive peer group.`,
    })
  } else if (speed.length) {
    const bits = speed.map((test) => `${test.label} ${formatRaw(test.raw as number, test.unit)} (${ratingLabel(test).toLowerCase()})`)
    out.push({
      heading: 'Speed and power',
      body: `${joinAnd(bits)} against the ${analysis.ageBandLabel} handbook window.`,
    })
  }

  if (skipped.some((test) => SPEED_POWER.has(test.subtest))) {
    out.push({
      heading: 'Power tests were not collected',
      body: `Vertical and broad jump came off the sheet${skipReason(skipped.filter((test) => SPEED_POWER.has(test.subtest)))}. This letter does not invent those scores. We will get a true power picture when ${first} is ready to jump.`,
    })
  }

  const typicalSupport = support.filter((test) => test.band === 'typical' || test.band === 'above')
  if (typicalSupport.length && weakSupport.length === 0) {
    const grip = support.filter((test) => test.subtest.includes('grip') && test.raw !== null)
    const sit = support.find((test) => test.subtest === 'sit_reach_cm' && test.raw !== null)
    const bal = support.filter((test) => test.subtest.includes('balance') && test.raw !== null)
    const parts: string[] = []
    if (grip.length === 2 && grip[0] && grip[1]) {
      parts.push(`grip strength (${formatRaw(grip[0].raw as number, 'kg')} / ${formatRaw(grip[1].raw as number, 'kg')})`)
    }
    if (sit) parts.push(`sit-and-reach (${formatRaw(sit.raw as number, 'cm')})`)
    if (bal.length === 2 && bal[0] && bal[1]) {
      parts.push(`single-leg balance (${formatRaw(bal[0].raw as number, 's')} / ${formatRaw(bal[1].raw as number, 's')})`)
    }
    out.push({
      heading: 'Solid foundation in supporting qualities',
      body: `${capitalize(joinAnd(parts))} all fall comfortably inside the typical band. There is no current deficit that would be expected to limit the main qualities on this sheet, though modest improvements in flexibility and balance symmetry can still support injury resilience and technical consistency.`,
    })
  }

  if (weakSupport.length) {
    out.push({
      heading: 'Clear limiter on this sheet',
      body: `${joinAnd(weakSupport.map((test) => `${test.label} at ${formatRaw(test.raw as number, test.unit)}`))} sat below typical for this group. That is the lever I would put at the top of the next block.`,
    })
  }

  if (analysis.midthigh) {
    out.push({
      heading: 'Isometric strength baseline established',
      body: `The mid-thigh pull of ${formatRaw(analysis.midthigh.raw, 'N')} provides a useful force-production reference for future testing. The 2019 handbook does not grade this test; tracking the number across blocks is the point. ${analysis.midthigh.of > 1 ? `Among this week's completed pulls it ranks ${analysis.midthigh.rank} of ${analysis.midthigh.of}.` : ''}`.trim(),
    })
  }

  if (analysis.flags.some((flag) => flag.kind === 'verify_outlier')) {
    const flag = analysis.flags.find((item) => item.kind === 'verify_outlier')
    out.push({
      heading: 'One number I would verify',
      body: `${flag?.text ?? 'A result sits well outside typical.'} I would rather confirm the trial than write a plan on it.`,
    })
  }

  if (analysis.flags.some((flag) => flag.kind === 'asymmetry')) {
    const splits = analysis.flags.filter((flag) => flag.kind === 'asymmetry').map((flag) => flag.text)
    out.push({
      heading: 'Left/right split',
      body: `${splits.join(' ')} I would rather name that than average it away.`,
    })
  }

  return out.slice(0, 4)
}

function buildRecommendations(
  analysis: Analysis,
  first: string,
  superiorSpeed: TestView[],
  weakSupport: TestView[],
  skipped: TestView[],
): ReportSection[] {
  const sport = analysis.athlete.sport.toLowerCase()
  const out: ReportSection[] = []
  const ankle = /ankle|sprain/.test(
    `${analysis.administration.conditions_note} ${analysis.tests.map((test) => test.note ?? '').join(' ')}`,
  )
  const wrist = /wrist/.test(analysis.tests.map((test) => test.note ?? '').join(' '))

  if (skipped.some((test) => SPEED_POWER.has(test.subtest))) {
    out.push({
      heading: 'Do not program the missing jumps',
      body: `Until we have a vertical and a broad jump, keep power work inside what ${first} can do pain-free. The letter should not pretend we measured explosiveness this week.`,
    })
  } else if (superiorSpeed.length >= 2 || /sprint|track|football|basketball|volleyball/.test(sport)) {
    out.push({
      heading: 'Speed and power maintenance / progression',
      body: `Given the clear superiority in speed and power, programming should keep quality sprint work, plyometrics, and resisted acceleration at the centre while protecting what is already there. Maintain high-intensity sprint volumes with adequate recovery. Continue vertical and horizontal plyometric progressions; consider adding contrast or complex pairs once technical quality is consistent.`,
    })
  }

  if (wrist) {
    out.push({
      heading: 'Retest the sore side before you load it',
      body: `Right-side grip was completed with wrist soreness on the sheet. I would rather retest than write a pulling block off that trial.`,
    })
  } else {
    out.push({
      heading: 'Strength support',
      body: analysis.midthigh
        ? `Use the mid-thigh pull (${formatRaw(analysis.midthigh.raw, 'N')}) as a monitoring tool. A well-rounded lower-body strength program — hip hinge and single-leg patterns — will support force production and transfer to ${sport.includes('run') || sport.includes('sprint') || sport.includes('track') ? 'sprinting' : 'the field'}.`
        : `A well-rounded lower-body strength program (hip hinge and single-leg patterns) will support force production on the next combine.`,
    })
  }

  const sit = analysis.tests.find((test) => test.subtest === 'sit_reach_cm')
  const balL = analysis.tests.find((test) => test.subtest === 'balance_left_s')
  const balR = analysis.tests.find((test) => test.subtest === 'balance_right_s')
  const split =
    balL?.raw !== null &&
    balR?.raw !== null &&
    balL &&
    balR &&
    Math.abs((balL.raw as number) - (balR.raw as number)) >= 2

  if (ankle) {
    out.push({
      heading: 'Return-to-run, then retest jumps',
      body: `The ankle history is the constraint, not a character note. Keep single-leg stability and calf/ankle capacity in the work; put jumping tests back on the sheet when ${first} asks for them.`,
    })
  } else {
    out.push({
      heading: 'Mobility and balance polish',
      body: `${sit?.raw !== null && sit ? `Sit-and-reach is ${formatRaw(sit.raw, 'cm')}, mid-range for this group.` : 'Mobility is not a red flag.'} Targeted hamstring and hip-flexor work can still clean up sprint mechanics.${split && balL && balR ? ` The ${formatRaw(balL.raw as number, 's')} vs ${formatRaw(balR.raw as number, 's')} balance split is small — single-leg stability drills will even it out and reinforce landing control.` : ''}`,
    })
  }

  if (weakSupport.length) {
    out.push({
      heading: `Make ${weakSupport[0]?.label.toLowerCase()} the next-block priority`,
      body: `That is the only quality on this sheet below typical. Give it a real block and retest it on purpose, not as an afterthought.`,
    })
  }

  out.push({
    heading: 'Retest cadence',
    body: `Re-test the full battery in 8–12 weeks after a focused block so we can see what moved — especially ${superiorSpeed.length ? 'the superior speed/power markers and ' : ''}the mid-thigh pull${skipped.length ? ', and the tests we skipped this time' : ''}.`,
  })

  return out.slice(0, 4)
}

function caveatsFor(analysis: Analysis): string[] {
  return analysis.flags
    .filter(
      (flag) =>
        flag.kind === 'skipped' ||
        flag.kind === 'quality' ||
        flag.kind === 'verify_outlier' ||
        flag.kind === 'conditions' ||
        flag.kind === 'asymmetry',
    )
    .map((flag) => flag.text)
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function capitalize(text: string): string {
  if (!text) return text
  return text[0]!.toUpperCase() + text.slice(1)
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
