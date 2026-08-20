import type { SubtestId } from './types.ts'

/**
 * Combine export schema — labels and units for the nine subtests.
 * Handbook ranges live in data/forge_coach_handbook_2019_v1.json and are looked up by metric.
 */
export const TEST_META: Record<SubtestId, { label: string; unit: string; short: string }> = {
  sprint_40m: { label: '40m sprint', unit: 's', short: 'sprint' },
  vertical_jump_cm: { label: 'Vertical jump', unit: 'cm', short: 'vertical' },
  broad_jump_cm: { label: 'Broad jump', unit: 'cm', short: 'broad jump' },
  grip_strength_left_kg: { label: 'Grip · left', unit: 'kg', short: 'left grip' },
  grip_strength_right_kg: { label: 'Grip · right', unit: 'kg', short: 'right grip' },
  midthigh_pull_n: { label: 'Mid-thigh pull', unit: 'N', short: 'mid-thigh pull' },
  sit_reach_cm: { label: 'Sit-and-reach', unit: 'cm', short: 'sit-and-reach' },
  balance_left_s: { label: 'Balance · left', unit: 's', short: 'left balance' },
  balance_right_s: { label: 'Balance · right', unit: 's', short: 'right balance' },
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
