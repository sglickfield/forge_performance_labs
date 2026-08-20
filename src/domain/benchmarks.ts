import type { AgeBand, Sex, SubtestId } from './types.ts'

export interface HandbookRange {
  lo: number
  hi: number
}

type HandbookKey =
  | 'sprint_40m'
  | 'vertical_jump_cm'
  | 'broad_jump_cm'
  | 'grip_strength_kg'
  | 'sit_reach_cm'
  | 'balance_s'

/**
 * 2019 coach handbook Appendix C, mirrored from
 * data/benchmarks.csv. Mid-thigh pull is intentionally absent.
 */
const HANDBOOK: Record<HandbookKey, Record<Sex, Record<AgeBand, HandbookRange>>> = {
  sprint_40m: {
    M: {
      '18_29': { lo: 4.6, hi: 5.5 },
      '30_39': { lo: 4.8, hi: 5.7 },
      '40_plus': { lo: 5.1, hi: 6.1 },
    },
    F: {
      '18_29': { lo: 5.3, hi: 6.3 },
      '30_39': { lo: 5.4, hi: 6.4 },
      '40_plus': { lo: 5.7, hi: 6.8 },
    },
  },
  vertical_jump_cm: {
    M: {
      '18_29': { lo: 44, hi: 64 },
      '30_39': { lo: 41, hi: 61 },
      '40_plus': { lo: 36, hi: 55 },
    },
    F: {
      '18_29': { lo: 31, hi: 47 },
      '30_39': { lo: 29, hi: 45 },
      '40_plus': { lo: 25, hi: 40 },
    },
  },
  broad_jump_cm: {
    M: {
      '18_29': { lo: 205, hi: 260 },
      '30_39': { lo: 195, hi: 250 },
      '40_plus': { lo: 180, hi: 235 },
    },
    F: {
      '18_29': { lo: 160, hi: 205 },
      '30_39': { lo: 155, hi: 200 },
      '40_plus': { lo: 140, hi: 185 },
    },
  },
  grip_strength_kg: {
    M: {
      '18_29': { lo: 39, hi: 56 },
      '30_39': { lo: 40, hi: 57 },
      '40_plus': { lo: 37, hi: 54 },
    },
    F: {
      '18_29': { lo: 25, hi: 36 },
      '30_39': { lo: 25, hi: 37 },
      '40_plus': { lo: 23, hi: 34 },
    },
  },
  sit_reach_cm: {
    M: {
      '18_29': { lo: -2, hi: 14 },
      '30_39': { lo: -3, hi: 13 },
      '40_plus': { lo: -5, hi: 11 },
    },
    F: {
      '18_29': { lo: 2, hi: 18 },
      '30_39': { lo: 1, hi: 17 },
      '40_plus': { lo: -1, hi: 15 },
    },
  },
  balance_s: {
    M: {
      '18_29': { lo: 16, hi: 40 },
      '30_39': { lo: 14, hi: 38 },
      '40_plus': { lo: 11, hi: 33 },
    },
    F: {
      '18_29': { lo: 18, hi: 42 },
      '30_39': { lo: 16, hi: 40 },
      '40_plus': { lo: 12, hi: 35 },
    },
  },
}

const HANDBOOK_FOR_SUBTEST: Partial<Record<SubtestId, HandbookKey>> = {
  sprint_40m: 'sprint_40m',
  vertical_jump_cm: 'vertical_jump_cm',
  broad_jump_cm: 'broad_jump_cm',
  grip_strength_left_kg: 'grip_strength_kg',
  grip_strength_right_kg: 'grip_strength_kg',
  sit_reach_cm: 'sit_reach_cm',
  balance_left_s: 'balance_s',
  balance_right_s: 'balance_s',
}

export function ageBandFor(age: number): AgeBand {
  if (age >= 40) return '40_plus'
  if (age >= 30) return '30_39'
  return '18_29'
}

export function ageBandLabel(band: AgeBand): string {
  if (band === '18_29') return '18–29'
  if (band === '30_39') return '30–39'
  return '40+'
}

export function handbookRange(
  subtest: SubtestId,
  sex: Sex,
  ageBand: AgeBand,
): HandbookRange | undefined {
  const key = HANDBOOK_FOR_SUBTEST[subtest]
  if (!key) return undefined
  return HANDBOOK[key][sex][ageBand]
}

export const TEST_META: Record<
  SubtestId,
  { label: string; unit: string; better: 'lower' | 'higher' | 'unknown'; short: string }
> = {
  sprint_40m: { label: '40m sprint', unit: 's', better: 'lower', short: 'sprint' },
  vertical_jump_cm: { label: 'Vertical jump', unit: 'cm', better: 'higher', short: 'vertical' },
  broad_jump_cm: { label: 'Broad jump', unit: 'cm', better: 'higher', short: 'broad jump' },
  grip_strength_left_kg: { label: 'Grip · left', unit: 'kg', better: 'higher', short: 'left grip' },
  grip_strength_right_kg: {
    label: 'Grip · right',
    unit: 'kg',
    better: 'higher',
    short: 'right grip',
  },
  midthigh_pull_n: { label: 'Mid-thigh pull', unit: 'N', better: 'unknown', short: 'mid-thigh pull' },
  sit_reach_cm: { label: 'Sit-and-reach', unit: 'cm', better: 'higher', short: 'sit-and-reach' },
  balance_left_s: { label: 'Balance · left', unit: 's', better: 'higher', short: 'left balance' },
  balance_right_s: { label: 'Balance · right', unit: 's', better: 'higher', short: 'right balance' },
}

export const SUBTEST_ORDER: SubtestId[] = [
  'sprint_40m',
  'vertical_jump_cm',
  'broad_jump_cm',
  'grip_strength_left_kg',
  'grip_strength_right_kg',
  'midthigh_pull_n',
  'sit_reach_cm',
  'balance_left_s',
  'balance_right_s',
]
