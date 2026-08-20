import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateReport } from '../server/generateReport.ts'
import { analyzeAthlete, sessionPullsFrom } from '../src/domain/analyze.ts'
import { listLatestExports } from '../server/athleteStore.ts'
import { cosine, embed, EMBEDDING_MODEL } from '../src/eval/embed.ts'
import { goldProse, loadGoldLetter } from '../src/eval/goldReports.ts'
import { flattenDraft } from '../src/eval/reportText.ts'
import type { GenerateMeta, ReportDraft } from '../src/domain/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'output')
const FLOOR = JSON.parse(readFileSync(join(root, 'src/eval/baselines.json'), 'utf8')).floor as number

interface CaseResult {
  athlete: string
  file: string
  source: GenerateMeta['source']
  model: string
  promptVersion: string
  cosine: number | null
  passed: boolean
  issues: { code: string; message: string }[]
  warning?: string
  error?: string
  draft?: ReportDraft
  liveText?: string
}

function loadApiKey(): string | undefined {
  try {
    const line = readFileSync(join(root, '.env'), 'utf8')
      .split('\n')
      .find((row) => row.startsWith('XAI_API_KEY='))
    const value = line?.slice('XAI_API_KEY='.length).trim()
    return value || process.env.XAI_API_KEY
  } catch {
    return process.env.XAI_API_KEY
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z')
}

function renderMarkdown(runId: string, rows: CaseResult[]): string {
  const lines = [
    `# Grok eval ${runId}`,
    '',
    `Model embeddings: ${EMBEDDING_MODEL}. Gold: \`golden_datasets/\`. Floor: ${FLOOR}.`,
    `Each run writes a new file; nothing is overwritten.`,
    '',
    '| Athlete | Source | Cosine | Pass |',
    '|---|---|---:|:---:|',
    ...rows.map((row) => {
      const score = row.cosine === null ? '—' : row.cosine.toFixed(3)
      return `| ${row.athlete} | ${row.source} | ${score} | ${row.passed ? 'yes' : 'no'} |`
    }),
    '',
  ]
  for (const row of rows) {
    lines.push(`---\n\n# ${row.athlete}\n`)
    if (row.error) {
      lines.push(`**Error:** ${row.error}\n`)
      continue
    }
    lines.push(`_${row.source} · ${row.model} · ${row.promptVersion} · cosine ${row.cosine?.toFixed(3) ?? '—'} vs gold PDF_\n`)
    if (row.warning) lines.push(`> ${row.warning}\n`)
    if (row.issues.length) {
      lines.push('Fact-check:', ...row.issues.map((issue) => `- ${issue.code}: ${issue.message}`), '')
    }
    if (row.liveText) lines.push(row.liveText, '')
  }
  return lines.join('\n')
}

async function main() {
  const apiKey = loadApiKey()
  if (!apiKey) {
    console.error('No XAI_API_KEY — skip Grok eval (template path is npm test).')
    process.exit(0)
  }

  const runId = stamp()
  mkdirSync(outDir, { recursive: true })
  const jsonPath = join(outDir, `grok-eval-${runId}.json`)
  const mdPath = join(outDir, `grok-eval-${runId}.md`)

  const loaded = listLatestExports()
  const exports = loaded.map((item) => item.export)
  const pulls = sessionPullsFrom(exports)
  const rows: CaseResult[] = []

  for (const item of loaded) {
    const file = item.sourceName
    const exp = item.export
    const name = exp.athlete.name
    process.stderr.write(`Grok ${name}...\n`)
    try {
      const result = await generateReport(
        { analysis: analyzeAthlete(exp, pulls), coachName: 'M. Sandoval' },
        apiKey,
      )
      const liveText = flattenDraft(result.draft)
      const gold = goldProse(loadGoldLetter(name))
      const [a, b] = await Promise.all([embed(liveText), embed(gold)])
      const score = cosine(a, b)
      rows.push({
        athlete: name,
        file,
        source: result.meta.source,
        model: result.meta.model,
        promptVersion: result.meta.promptVersion,
        cosine: score,
        passed: result.meta.source === 'grok' && score >= FLOOR,
        issues: result.issues,
        warning: result.meta.warning,
        draft: result.draft,
        liveText,
      })
      process.stderr.write(`  ${result.meta.source} cosine=${score.toFixed(3)}\n`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`  FAILED ${message}\n`)
      rows.push({
        athlete: name,
        file,
        source: 'template',
        model: 'none',
        promptVersion: '',
        cosine: null,
        passed: false,
        issues: [],
        error: message,
      })
    }
  }

  const payload = {
    runId,
    generatedAt: new Date().toISOString(),
    embeddingModel: EMBEDDING_MODEL,
    floor: FLOOR,
    gold: 'golden_datasets/',
    passed: rows.every((row) => row.passed),
    cases: rows,
  }
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2))
  writeFileSync(mdPath, renderMarkdown(runId, rows))
  process.stderr.write(`Wrote ${mdPath}\nWrote ${jsonPath}\n`)
  if (!payload.passed) process.exit(1)
}

void main()
