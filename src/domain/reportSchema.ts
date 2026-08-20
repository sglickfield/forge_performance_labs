import { PROMPT_EXAMPLE } from './promptExample.ts'
import type { ReportDraft, ReportSection } from './types.ts'

export const PROMPT_VERSION = 'forge-report-v4'
export const REPORT_MODEL = 'grok-4.6'

const SECTION = {
  type: 'object',
  additionalProperties: false,
  required: ['heading', 'body'],
  properties: {
    heading: { type: 'string' },
    body: {
      type: 'string',
      description: 'A full paragraph (at least four sentences). Specific numbers. Sport-aware. Not a one-liner.',
    },
  },
} as const

export const REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'overview', 'takeaways', 'recommendations', 'caveats'],
  properties: {
    headline: {
      type: 'string',
      description: 'The athletic story in a few words. Example: “Standout explosive speed and power.” Never hedge a Superior score as “just barely.”',
    },
    overview: {
      type: 'string',
      description:
        'Two or three full sentences: what was tested, which handbook band, that ranges are recreational-to-competitive not elite. Athlete-facing. Do not explain our internal scoring rules.',
    },
    takeaways: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: SECTION,
      description:
        'Two to four clustered takeaways. Group speed+power, supporting qualities, and any real issue (skip, split, verify). Full paragraphs with numbers. Do not narrate nine tests.',
    },
    recommendations: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: SECTION,
      description:
        'Three to five coaching recommendations a high-end coach would sign. Full paragraphs. Name methods (sprint quality, resisted acceleration, vertical and horizontal plyometrics, contrast pairs, hip hinge, single-leg strength, hamstring/hip-flexor mobility, retest in 8–12 weeks). No sets/reps, no diagnosis, no invented scores.',
    },
    caveats: {
      type: 'array',
      items: { type: 'string' },
      description:
        'ONLY real problems: skipped tests, tester notes, verify-outlier flags, injury conditions. If none, return []. Never write “no tests were skipped” or “no handbook range” — the table already covers that.',
    },
  },
} as const

export function emptyDraft(): ReportDraft {
  return {
    headline: '',
    overview: '',
    takeaways: [],
    recommendations: [],
    caveats: [],
  }
}

function isSection(value: unknown): value is ReportSection {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.heading === 'string' && typeof v.body === 'string'
}

export function isReportDraft(value: unknown): value is ReportDraft {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.headline === 'string' &&
    typeof v.overview === 'string' &&
    Array.isArray(v.takeaways) &&
    v.takeaways.every(isSection) &&
    Array.isArray(v.recommendations) &&
    v.recommendations.every(isSection) &&
    Array.isArray(v.caveats) &&
    v.caveats.every((item) => typeof item === 'string')
  )
}

export function normalizeDraft(value: unknown): ReportDraft | undefined {
  if (!isReportDraft(value)) return undefined
  return {
    headline: value.headline,
    overview: value.overview,
    takeaways: value.takeaways,
    recommendations: value.recommendations,
    caveats: value.caveats,
  }
}

export function cleanDraft(draft: ReportDraft): ReportDraft {
  return {
    ...draft,
    caveats: draft.caveats.filter((item) => {
      const text = item.toLowerCase()
      if (!item.trim()) return false
      if (/no tests were skipped/.test(text)) return false
      if (/no tester/.test(text)) return false
      if (/no condition/.test(text)) return false
      if (/not in the 2019 handbook/.test(text)) return false
      if (/no typical range is claimed/.test(text)) return false
      if (/no handbook/.test(text)) return false
      return true
    }),
  }
}

export function systemPrompt(): string {
  return [
    'You are an experienced high-performance coach writing the combine report the athlete keeps.',
    'Match the QUALITY, LENGTH, and USEFULNESS of the example report. Write full paragraphs, not bullets disguised as sentences.',
    'A Superior score is Superior — do not hedge it as “just above” or “just clears.”',
    'Talk to the athlete about what the numbers mean for their sport. Do not mention schemas, fact packs, bands as internal codes, or “suggestedFocus.”',
    'You may recommend training methods. That is the job. Do not invent diagnoses, sets, reps, or skipped-test numbers.',
    'Caveats only for real problems. Empty array if the sheet is clean.',
    'Return only the JSON object.',
  ].join(' ')
}

export function userPrompt(facts: Record<string, unknown>, coachName: string, coachNote: string): string {
  const extra = coachNote.trim()
    ? `\n\nCoach direction for this redraft:\n${coachNote.trim()}`
    : ''
  return `I'm a coach and these are the results from a client combine. Take these and turn it into a meaningful report for them. Here are the benchmarks, already applied to each test.

Write a report I would be proud to put my name on. Same depth as this example (use it as a quality bar, not a source of this athlete's numbers):

${PROMPT_EXAMPLE}

Signing coach (do not put this name in the report body): ${coachName || '(coach will type their name)'}
${extra}

THIS ATHLETE'S RESULTS:
${JSON.stringify(facts, null, 2)}`
}
