import { describe, expect, it } from 'vitest'
import { bandFromScore } from './confidence.ts'

describe('bandFromScore', () => {
  it('maps the desk thresholds', () => {
    expect(bandFromScore(0.8)).toBe('high')
    expect(bandFromScore(0.99)).toBe('high')
    expect(bandFromScore(0.799)).toBe('medium')
    expect(bandFromScore(0.7)).toBe('medium')
    expect(bandFromScore(0.699)).toBe('low')
    expect(bandFromScore(0)).toBe('low')
  })
})
