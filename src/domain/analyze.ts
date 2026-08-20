import {
  ageBandFor,
  ageBandLabel,
  handbookBetter,
  handbookEdition,
  handbookRange,
} from './handbook.ts'
import { SUBTEST_ORDER, TEST_META } from './subtests.ts'
import type {
  Analysis,
  AthleteExport,
  Band,
  Flag,
  RawResult,
  TestView,
} from './types.ts'

const OUTLIER_PAD = 0.1
const GRIP_ASYMMETRY = 0.1
const BALANCE_ASYMMETRY = 0.15

export function formatRaw(raw: number, unit: string): string {
  const abs = Math.abs(raw)
  const digits = abs >= 100 || Number.isInteger(raw) ? 0 : abs >= 10 ? 1 : 2
  const trimmed = raw.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  const negative = trimmed.startsWith('-')
  const [whole, frac] = (negative ? trimmed.slice(1) : trimmed).split('.')
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const value = `${negative ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`
  return `${value} ${unit}`
}

function bandFor(test: {
  raw: number | null
  status: 'completed' | 'skipped'
  range?: { lo: number; hi: number }
  better: 'lower' | 'higher' | 'unknown'
}): Band {
  if (test.status === 'skipped' || test.raw === null) return 'skipped'
  if (!test.range || test.better === 'unknown') return 'unbenchmarked'
  const { lo, hi } = test.range
  if (test.better === 'lower') {
    if (test.raw < lo) return 'above'
    if (test.raw > hi) return 'below'
    return 'typical'
  }
  if (test.raw > hi) return 'above'
  if (test.raw < lo) return 'below'
  return 'typical'
}

function isFarOutside(raw: number, range: { lo: number; hi: number }, better: 'lower' | 'higher') {
  if (better === 'lower') {
    return raw < range.lo * (1 - OUTLIER_PAD) || raw > range.hi * (1 + OUTLIER_PAD)
  }
  const spanFloor = Math.max(Math.abs(range.lo), 1)
  return raw > range.hi * (1 + OUTLIER_PAD) || raw < range.lo - spanFloor * OUTLIER_PAD
}

function relativeDiff(a: number, b: number): number {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1)
  return Math.abs(a - b) / denom
}

function lookup(results: RawResult[], id: RawResult['subtest']): RawResult | undefined {
  return results.find((result) => result.subtest === id)
}

export function analyzeAthlete(exp: AthleteExport, sessionPulls: number[] = []): Analysis {
  const { athlete, administration, results } = exp
  const ageBand = ageBandFor(athlete.age)
  const tests: TestView[] = SUBTEST_ORDER.map((subtest) => {
    const row = lookup(results, subtest)
    const meta = TEST_META[subtest]
    const range = handbookRange(subtest, athlete.sex, athlete.age)
    const status = row?.status ?? 'skipped'
    const raw = row?.raw ?? null
    const view: TestView = {
      subtest,
      label: meta.label,
      unit: meta.unit,
      raw,
      status,
      note: row?.note,
      range,
      better: handbookBetter(subtest),
      band: 'skipped',
    }
    view.band = bandFor(view)
    return view
  })

  const flags: Flag[] = []

  if (administration.conditions_note) {
    flags.push({ kind: 'conditions', text: administration.conditions_note })
  }

  for (const test of tests) {
    if (test.status === 'skipped') {
      flags.push({
        kind: 'skipped',
        subtest: test.subtest,
        text: test.note
          ? `${test.label} skipped — ${test.note}`
          : `${test.label} was skipped. Do not invent a score.`,
      })
    }
    if (test.note && test.status === 'completed') {
      const quality = /rush|distract|soreness|wrist|sprain|long day|8pm|headwind/i.test(test.note)
      flags.push({
        kind: quality ? 'quality' : 'tester_note',
        subtest: test.subtest,
        text: `${test.label}: ${test.note}`,
      })
    }
    if (
      test.raw !== null &&
      test.range &&
      (test.better === 'lower' || test.better === 'higher') &&
      isFarOutside(test.raw, test.range, test.better)
    ) {
      flags.push({
        kind: 'verify_outlier',
        subtest: test.subtest,
        text: `${test.label} (${formatRaw(test.raw, test.unit)}) sits well outside the ${ageBandLabel(ageBand)} ${athlete.sex} typical range (${test.range.lo}–${test.range.hi} ${test.unit}). Verify before treating it as gospel.`,
      })
    }
    if (test.status === 'completed' && !test.range) {
      flags.push({
        kind: 'no_handbook',
        subtest: test.subtest,
        text: `${test.label} is not in the 2019 handbook. No typical range is claimed.`,
      })
    }
  }

  const leftGrip = lookup(results, 'grip_strength_left_kg')
  const rightGrip = lookup(results, 'grip_strength_right_kg')
  if (
    leftGrip?.status === 'completed' &&
    rightGrip?.status === 'completed' &&
    leftGrip.raw !== null &&
    rightGrip.raw !== null &&
    relativeDiff(leftGrip.raw, rightGrip.raw) >= GRIP_ASYMMETRY
  ) {
    flags.push({
      kind: 'asymmetry',
      subtest: 'grip_strength_right_kg',
      text: `Grip split: L ${formatRaw(leftGrip.raw, 'kg')} / R ${formatRaw(rightGrip.raw, 'kg')}.`,
    })
  }

  const leftBal = lookup(results, 'balance_left_s')
  const rightBal = lookup(results, 'balance_right_s')
  if (
    leftBal?.status === 'completed' &&
    rightBal?.status === 'completed' &&
    leftBal.raw !== null &&
    rightBal.raw !== null &&
    relativeDiff(leftBal.raw, rightBal.raw) >= BALANCE_ASYMMETRY
  ) {
    flags.push({
      kind: 'asymmetry',
      subtest: 'balance_right_s',
      text: `Balance split: L ${formatRaw(leftBal.raw, 's')} / R ${formatRaw(rightBal.raw, 's')}.`,
    })
  }

  const pull = tests.find((test) => test.subtest === 'midthigh_pull_n')
  let midthigh: Analysis['midthigh']
  if (pull?.status === 'completed' && pull.raw !== null) {
    const cohort = [...sessionPulls]
    if (!cohort.includes(pull.raw)) cohort.push(pull.raw)
    const desc = [...cohort].sort((a, b) => b - a)
    midthigh = { raw: pull.raw, rank: desc.indexOf(pull.raw) + 1, of: desc.length }
  }

  return {
    athlete,
    administration,
    ageBand,
    ageBandLabel: ageBandLabel(ageBand),
    tests,
    flags,
    midthigh,
  }
}

export function sessionPullsFrom(exports: AthleteExport[]): number[] {
  return exports
    .flatMap((exp) => exp.results)
    .filter((row) => row.subtest === 'midthigh_pull_n' && row.status === 'completed' && row.raw !== null)
    .map((row) => row.raw as number)
}

export function factPack(analysis: Analysis): Record<string, unknown> {
  return {
    athlete: {
      name: analysis.athlete.name,
      firstName: analysis.athlete.name.split(' ')[0],
      age: analysis.athlete.age,
      sex: analysis.athlete.sex,
      sport: analysis.athlete.sport,
      tested_on: analysis.athlete.tested_on,
      athlete_id: analysis.athlete.athlete_id,
    },
    administration: analysis.administration,
    handbook: {
      edition: handbookEdition(),
      ageBand: analysis.ageBandLabel,
      sex: analysis.athlete.sex,
    },
    tests: analysis.tests.map((test) => ({
      id: test.subtest,
      label: test.label,
      unit: test.unit,
      raw: test.raw,
      display: test.raw === null ? 'skipped' : formatRaw(test.raw, test.unit),
      status: test.status,
      band: test.band,
      rating:
        test.band === 'above'
          ? 'Superior'
          : test.band === 'below'
            ? 'Below typical'
            : test.band === 'unbenchmarked'
              ? 'Recorded (no handbook range)'
              : test.band === 'skipped'
                ? 'Not tested'
                : 'Typical',
      typicalRange: test.range ? `${test.range.lo} to ${test.range.hi} ${test.unit}` : null,
      better: test.better,
      note: test.note ?? null,
    })),
    flags: analysis.flags
      .filter((flag) => flag.kind !== 'no_handbook')
      .map((flag) => ({ kind: flag.kind, text: flag.text })),
    midthighPull: analysis.midthigh
      ? {
          rawN: analysis.midthigh.raw,
          rankInThisCombine: analysis.midthigh.rank,
          combineSize: analysis.midthigh.of,
          handbookRange: null,
          note: 'No 2019 handbook range. Record as a baseline, do not grade it, do not mention rank unless the combine has several athletes.',
        }
      : null,
  }
}
