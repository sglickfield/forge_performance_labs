import type { ReportDraft } from './types.ts'

export const PROMPT_VERSION = 'forge-report-v1'
export const REPORT_MODEL = 'grok-4.6'

export const REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'headline',
    'greeting',
    'what_we_saw',
    'keep_doing',
    'focus_next',
    'caveats',
    'signoff',
    'coach_brief',
  ],
  properties: {
    headline: {
      type: 'string',
      description: 'One line the athlete can remember. No invented numbers.',
    },
    greeting: {
      type: 'string',
      description: 'One short opening line addressing the athlete by first name.',
    },
    what_we_saw: {
      type: 'string',
      description: 'One or two short paragraphs. Specific to this combine. Use only fact-pack numbers.',
    },
    keep_doing: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two or three things that were genuinely good.',
    },
    focus_next: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two or three focuses. Not a training program.',
    },
    caveats: {
      type: 'array',
      items: { type: 'string' },
      description: 'Skipped tests, tester notes, verify flags. Empty only if none exist.',
    },
    signoff: {
      type: 'string',
      description: 'One warm, short closing line. Do not include the coach name.',
    },
    coach_brief: {
      type: 'string',
      description: 'Internal note for the coach: what to watch, what to edit, what to retest.',
    },
  },
} as const

export function emptyDraft(): ReportDraft {
  return {
    headline: '',
    greeting: '',
    what_we_saw: '',
    keep_doing: ['', ''],
    focus_next: ['', ''],
    caveats: [],
    signoff: '',
    coach_brief: '',
  }
}

export function isReportDraft(value: unknown): value is ReportDraft {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.headline === 'string' &&
    typeof v.greeting === 'string' &&
    typeof v.what_we_saw === 'string' &&
    Array.isArray(v.keep_doing) &&
    v.keep_doing.every((item) => typeof item === 'string') &&
    Array.isArray(v.focus_next) &&
    v.focus_next.every((item) => typeof item === 'string') &&
    Array.isArray(v.caveats) &&
    v.caveats.every((item) => typeof item === 'string') &&
    typeof v.signoff === 'string' &&
    typeof v.coach_brief === 'string'
  )
}

export function systemPrompt(): string {
  return [
    'You write combine letters for Forge Performance Labs.',
    'The coach is high-touch (about ten athletes, not a thousand). They used to handwrite: what I saw, what to keep, what to focus on, what was off.',
    'The letter goes to a paying athlete. A coach name will be signed under it.',
    'You receive a fact pack. Those facts are the only measurements you may use.',
    'If a test is skipped, say it was not tested. Never fill in a number.',
    'Do not invent exercise science, diagnoses, or programming.',
    'Voice: specific, calm, expensive. Like a note from a coach who actually watched the session.',
    'Return only the JSON object described by the schema.',
  ].join(' ')
}

export function userPrompt(facts: Record<string, unknown>, coachName: string, coachNote: string): string {
  const extra = coachNote.trim()
    ? `\n\nCoach direction for this redraft:\n${coachNote.trim()}`
    : ''
  return `Draft the letter and the internal coach brief.\nSigning coach (do not put this name in signoff): ${coachName || '(coach will type their name)'}\n\nFACT PACK:\n${JSON.stringify(facts, null, 2)}${extra}`
}
