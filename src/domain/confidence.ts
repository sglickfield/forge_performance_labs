export type ConfidenceBand = 'high' | 'medium' | 'low'

export interface Confidence {
  score: number
  band: ConfidenceBand
}

/** high ≥ 0.8, medium 0.7–0.799, low < 0.7 */
export function bandFromScore(score: number): ConfidenceBand {
  if (score >= 0.8) return 'high'
  if (score >= 0.7) return 'medium'
  return 'low'
}

export function confidenceLabel(band: ConfidenceBand): string {
  if (band === 'high') return 'High'
  if (band === 'medium') return 'Medium'
  return 'Low'
}
