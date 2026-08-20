import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzeAthlete } from '../domain/analyze.ts'
import { writeTemplateReport } from '../domain/templateWriter.ts'
import { listLatestExports } from '../../server/athleteStore.ts'
import { cosine, embed, EMBEDDING_MODEL } from './embed.ts'
import { goldProse, listGoldLetters, loadGoldLetter } from './goldReports.ts'
import { flattenDraft } from './reportText.ts'

const root = dirname(fileURLToPath(import.meta.url))

interface BaselineFile {
  model: string
  floor: number
  maxDrop: number
  cases: Record<string, { baseline: number; note: string }>
}

const baselines = JSON.parse(readFileSync(join(root, 'baselines.json'), 'utf8')) as BaselineFile

describe('semantic drift (local MiniLM embeddings)', () => {
  it('uses one gold PDF letter per sample athlete', () => {
    const expected = listLatestExports().map(
      (item) => `${item.export.athlete.name.replace(/\s+/g, '_')}_Combine_Report.txt`,
    ).sort()
    expect(listGoldLetters()).toEqual(expected)
  })

  it('stays close to the golden_datasets letters and reports the scores', async () => {
    expect(baselines.model).toBe(EMBEDDING_MODEL)
    const rows: { id: string; score: number; baseline: number }[] = []

    for (const item of listLatestExports()) {
      const exp = item.export
      const id = exp.athlete.name
      const draft = writeTemplateReport(analyzeAthlete(exp))
      const current = flattenDraft(draft)
      const gold = goldProse(loadGoldLetter(id))
      const [a, b] = await Promise.all([embed(current), embed(gold)])
      const score = cosine(a, b)
      const baseline = baselines.cases[id]?.baseline
      if (baseline === undefined) {
        throw new Error(`No baseline for ${id} — add it to src/eval/baselines.json`)
      }
      rows.push({ id, score, baseline })
    }

    const table = rows
      .map((row) => {
        const delta = row.score - row.baseline
        const sign = delta >= 0 ? '+' : ''
        return `${row.id.padEnd(18)} cosine=${row.score.toFixed(3)}  baseline=${row.baseline.toFixed(3)}  Δ=${sign}${delta.toFixed(3)}`
      })
      .join('\n')
    console.log(`\nSemantic drift vs golden_datasets/ (${EMBEDDING_MODEL})\n${table}\n`)

    for (const row of rows) {
      expect(row.score, `${row.id} fell below floor ${baselines.floor}`).toBeGreaterThanOrEqual(baselines.floor)
      expect(
        row.score,
        `${row.id} drifted ${((row.baseline - row.score) * 100).toFixed(1)} pts from baseline ${row.baseline} (max drop ${baselines.maxDrop})`,
      ).toBeGreaterThanOrEqual(row.baseline - baselines.maxDrop)
    }
  }, 180_000)
})
