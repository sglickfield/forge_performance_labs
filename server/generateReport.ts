import { factCheck } from '../src/domain/factCheck.ts'
import { factPack } from '../src/domain/analyze.ts'
import {
  cleanDraft,
  isReportDraft,
  PROMPT_VERSION,
  REPORT_JSON_SCHEMA,
  REPORT_MODEL,
  systemPrompt,
  userPrompt,
} from '../src/domain/reportSchema.ts'
import { writeTemplateReport } from '../src/domain/templateWriter.ts'
import type { Analysis, GenerateMeta, ReportDraft } from '../src/domain/types.ts'

export interface GenerateRequest {
  analysis: Analysis
  coachName: string
  coachNote?: string
}

export interface GenerateResponse {
  draft: ReportDraft
  meta: GenerateMeta
  issues: { code: string; message: string }[]
}

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[]
  error?: { message?: string }
}

export async function generateReport(
  req: GenerateRequest,
  apiKey: string | undefined,
): Promise<GenerateResponse> {
  const facts = factPack(req.analysis)
  if (!apiKey) {
    return fromTemplate(req.analysis, req.coachName, 'No XAI_API_KEY — used the deterministic writer.')
  }

  try {
    const draft = cleanDraft(await callGrok(facts, req.coachName, req.coachNote ?? '', apiKey))
    const issues = factCheck(req.analysis, draft)
    if (issues.some((issue) => issue.code === 'invented_skip_score')) {
      const fallback = writeTemplateReport(req.analysis, req.coachName)
      return {
        draft: fallback,
        meta: {
          source: 'template',
          model: REPORT_MODEL,
          promptVersion: PROMPT_VERSION,
          generatedAt: new Date().toISOString(),
          warning: 'Grok draft failed the fact-check (invented a skipped score). Fell back to the deterministic writer.',
        },
        issues: factCheck(req.analysis, fallback),
      }
    }
    return {
      draft,
      meta: {
        source: 'grok',
        model: REPORT_MODEL,
        promptVersion: PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
      },
      issues,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Grok request failed'
    return fromTemplate(req.analysis, req.coachName, `Grok unavailable (${message}). Used the deterministic writer.`)
  }
}

function fromTemplate(analysis: Analysis, coachName: string, warning: string): GenerateResponse {
  const draft = cleanDraft(writeTemplateReport(analysis, coachName))
  return {
    draft,
    meta: {
      source: 'template',
      model: 'template-writer',
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      warning,
    },
    issues: factCheck(analysis, draft),
  }
}

async function callGrok(
  facts: Record<string, unknown>,
  coachName: string,
  coachNote: string,
  apiKey: string,
): Promise<ReportDraft> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userPrompt(facts, coachName, coachNote) },
  ]

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: REPORT_MODEL,
      messages,
      temperature: 0.7,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'coach_report',
          strict: true,
          schema: REPORT_JSON_SCHEMA,
        },
      },
    }),
  })

  const body = (await response.json()) as ChatCompletionResponse
  if (!response.ok) {
    throw new Error(body.error?.message || `HTTP ${response.status}`)
  }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty model response')
  const parsed: unknown = JSON.parse(content)
  if (!isReportDraft(parsed)) throw new Error('Model JSON did not match the report schema')
  return {
    ...parsed,
    takeaways: parsed.takeaways.filter((section) => section.heading.trim() || section.body.trim()),
    recommendations: parsed.recommendations.filter(
      (section) => section.heading.trim() || section.body.trim(),
    ),
    caveats: parsed.caveats.filter((item) => item.trim()),
  }
}
