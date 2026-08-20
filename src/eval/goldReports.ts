import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const GOLD_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../golden_datasets/text')

/** PDFs in golden_datasets/ are the source of truth. text/ is extracted for embeddings. */
export function loadGoldLetter(athleteName: string): string {
  const stem = `${athleteName.replace(/\s+/g, '_')}_Combine_Report.txt`
  return readFileSync(join(GOLD_DIR, stem), 'utf8')
}

/** Narrative only — table chrome would dominate MiniLM and hide letter drift. */
export function goldProse(fullText: string): string {
  const start = fullText.search(/Performance Overview/i)
  const end = fullText.search(/This report is intended for coaching/i)
  const slice = fullText.slice(start >= 0 ? start : 0, end >= 0 ? end : undefined)
  return slice
    .replace(/Detailed Results vs\. Benchmarks[\s\S]*?(?=Key Takeaways)/i, '')
    .replace(/\u007f/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function listGoldLetters(): string[] {
  return readdirSync(GOLD_DIR)
    .filter((name) => name.endsWith('_Combine_Report.txt'))
    .sort()
}
