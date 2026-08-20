import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bandFromScore, type Confidence } from '../src/domain/confidence.ts'
import type { ReportDraft } from '../src/domain/types.ts'
import { cosine, embed } from '../src/eval/embed.ts'
import { goldProse, loadGoldLetter } from '../src/eval/goldReports.ts'
import { flattenDraft } from '../src/eval/reportText.ts'

const goldTextDir = join(dirname(fileURLToPath(import.meta.url)), '../golden_datasets/text')

export function hasGoldLetter(athleteName: string): boolean {
  const stem = `${athleteName.replace(/\s+/g, '_')}_Combine_Report.txt`
  return existsSync(join(goldTextDir, stem))
}

export type GoldClassification =
  | { goldStatus: 'scored'; confidence: Confidence }
  | { goldStatus: 'missing' }

export async function classifyAgainstGold(
  athleteName: string,
  draft: ReportDraft,
): Promise<GoldClassification> {
  if (!hasGoldLetter(athleteName)) return { goldStatus: 'missing' }
  const live = flattenDraft(draft)
  const gold = goldProse(loadGoldLetter(athleteName))
  const [a, b] = await Promise.all([embed(live), embed(gold)])
  const score = cosine(a, b)
  return { goldStatus: 'scored', confidence: { score, band: bandFromScore(score) } }
}

export async function scoreAgainstGold(
  athleteName: string,
  draft: ReportDraft,
): Promise<Confidence | undefined> {
  const result = await classifyAgainstGold(athleteName, draft)
  return result.goldStatus === 'scored' ? result.confidence : undefined
}
