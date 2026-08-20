import type { ReportDraft } from '../domain/types.ts'

/** Flatten the athlete-facing letter so embeddings compare content, not JSON keys. */
export function flattenDraft(draft: ReportDraft): string {
  return [
    draft.headline,
    draft.overview,
    ...draft.takeaways.map((section) => `${section.heading}. ${section.body}`),
    ...draft.recommendations.map((section) => `${section.heading}. ${section.body}`),
    ...draft.caveats,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n')
}
