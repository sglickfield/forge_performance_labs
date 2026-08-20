import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateReport } from '../server/generateReport.ts'
import { analyzeAthlete, sessionPullsFrom } from '../src/domain/analyze.ts'
import { listLatestExports } from '../server/athleteStore.ts'
import type { ReportDraft } from '../src/domain/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'output')
const outPath = join(outDir, 'all-sample-reports.md')

function section(title: string, body: string): string {
  return `### ${title}\n\n${body.trim()}\n`
}

function renderDraft(draft: ReportDraft): string {
  const parts = [
    `**Headline:** ${draft.headline}`,
    '',
    section('Overview', draft.overview),
    ...draft.takeaways.map((item) => section(item.heading, item.body)),
    '### Coaching recommendations\n',
    ...draft.recommendations.map((item) => `**${item.heading}.** ${item.body}\n`),
  ]
  if (draft.caveats.length) {
    parts.push('### Caveats\n', ...draft.caveats.map((item) => `- ${item}\n`))
  }
  parts.push(section('Coach brief (internal)', draft.coach_brief))
  return parts.join('\n')
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

function save(chunks: string[]) {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outPath, chunks.join('\n'))
}

async function main() {
  const apiKey = loadApiKey()
  mkdirSync(outDir, { recursive: true })
  const loaded = listLatestExports()
  const exports = loaded.map((item) => item.export)
  const pulls = sessionPullsFrom(exports)

  const chunks: string[] = [
    '# Combine reports — July sample week',
    '',
    `Generated ${new Date().toISOString()} via generateReport (forge-report-v4).`,
    '',
  ]
  save(chunks)

  for (const item of loaded) {
    const name = item.sourceName
    const exp = item.export
    const analysis = analyzeAthlete(exp, pulls)
    process.stderr.write(`Generating ${exp.athlete.name} (${name})...\n`)
    try {
      const result = await generateReport(
        { analysis, coachName: 'M. Sandoval', coachNote: '' },
        apiKey,
      )
      const meta = result.meta
      chunks.push(
        `---\n\n# ${exp.athlete.name}`,
        '',
        `${exp.athlete.sport} · ${exp.athlete.age}${exp.athlete.sex} · ${exp.athlete.tested_on} · ${exp.athlete.athlete_id}`,
        '',
        `_${meta.source} · ${meta.model} · ${meta.promptVersion}_`,
        '',
      )
      if (meta.warning) chunks.push(`> ${meta.warning}`, '')
      if (result.issues.length) {
        chunks.push('Fact-check:', ...result.issues.map((issue) => `- ${issue.code}: ${issue.message}`), '')
      }
      chunks.push(renderDraft(result.draft), '')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`  FAILED: ${message}\n`)
      chunks.push(`---\n\n# ${exp.athlete.name}\n\n**Generation failed:** ${message}\n`)
    }
    save(chunks)
  }

  process.stderr.write(`Wrote ${outPath}\n`)
}

void main()
