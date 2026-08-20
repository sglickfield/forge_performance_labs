import type { CoachVerdict } from './types.ts'

export const COACH_VERDICTS: { id: CoachVerdict; label: string; hint: string }[] = [
  { id: 'ready', label: 'Ready', hint: 'Light or no edit. I would send this.' },
  { id: 'edited', label: 'Edited', hint: 'I rewrote parts. Usable, not my voice yet.' },
  { id: 'rewrite', label: 'Rewrite', hint: 'I would not send this. Unlock and redraft.' },
]

export function verdictLabel(verdict: CoachVerdict): string {
  return COACH_VERDICTS.find((item) => item.id === verdict)?.label ?? verdict
}

export function verdictHint(verdict: CoachVerdict): string {
  return COACH_VERDICTS.find((item) => item.id === verdict)?.hint ?? ''
}

export function letterWasEdited(
  draft: { overview?: string } | undefined,
  letter: { overview?: string } | undefined,
): boolean {
  if (!draft || !letter) return false
  return JSON.stringify(draft) !== JSON.stringify(letter)
}
