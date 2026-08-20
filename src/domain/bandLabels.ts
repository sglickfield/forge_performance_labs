import { formatRaw } from './format.ts'
import type { TestView } from './types.ts'

export function ratingLabel(test: TestView): string {
  if (test.status === 'skipped' || test.band === 'skipped') return 'Not tested'
  if (test.band === 'unbenchmarked') return 'Recorded'
  if (test.band === 'above') return 'Superior'
  if (test.band === 'below') return 'Below typical'
  return 'Typical'
}

export function interpretation(test: TestView): string {
  if (test.status === 'skipped') {
    return test.note || 'Not tested this session'
  }
  if (test.band === 'unbenchmarked') return 'No handbook benchmark available'
  if (test.band === 'above' && test.better === 'lower') {
    return 'Faster than typical range (lower time is better)'
  }
  if (test.band === 'above') return 'Above typical range'
  if (test.band === 'below' && test.better === 'lower') {
    return 'Slower than typical range'
  }
  if (test.band === 'below') return 'Below typical range'
  return 'Within typical range'
}

export function rangeLabel(test: TestView): string {
  if (!test.range) return '—'
  return `${formatRangeBound(test.range.lo)} – ${formatRangeBound(test.range.hi)} ${test.unit}`
}

export function resultLabel(test: TestView): string {
  if (test.raw === null) return '—'
  return formatRaw(test.raw, test.unit)
}

function formatRangeBound(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(n)
}
