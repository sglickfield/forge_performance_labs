import type {
  Administration,
  AthleteIdentity,
  AthleteRecord,
  ReportDraft,
  TestView,
} from './types.ts'

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

export interface PublicLetter {
  athlete: AthleteIdentity
  administration: Administration
  ageBandLabel: string
  tests: TestView[]
  letter: ReportDraft
  signedAt: string
  signedBy: string
}

export interface SharedLetter extends PublicLetter {
  token: string
}

export function athleteSharePath(token: string): string {
  return `/a/${token}`
}

export function shareTokenFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/a\/([A-Za-z0-9_-]{16,64})$/)
  return match?.[1] ?? null
}

/** Athlete-facing copy: no flags, ratings, or desk chrome. */
export function publicLetterFrom(record: AthleteRecord): PublicLetter {
  if (!record.letter) throw new Error('No letter to share')
  if (record.status !== 'signed' || !record.signedAt || !record.signedBy) {
    throw new Error('Only a signed letter can be shared')
  }
  return {
    athlete: record.export.athlete,
    administration: record.export.administration,
    ageBandLabel: record.analysis.ageBandLabel,
    tests: record.analysis.tests,
    letter: record.letter,
    signedAt: record.signedAt,
    signedBy: record.signedBy,
  }
}
