import { analyzeAthlete, sessionPullsFrom } from '../domain/analyze'
import type { Analysis, AthleteExport, AthleteRecord, CombineSession, ReportDraft } from '../domain/types'

const KEY = 'forge.combine.v1'

function reanalyze(session: CombineSession): CombineSession {
  const exports = Object.values(session.athletes).map((record) => record.export)
  const pulls = sessionPullsFrom(exports)
  const athletes: CombineSession['athletes'] = {}
  for (const [id, record] of Object.entries(session.athletes)) {
    athletes[id] = { ...record, analysis: analyzeAthlete(record.export, pulls) }
  }
  return { ...session, athletes }
}

export function emptySession(coachName = ''): CombineSession {
  return { version: 1, coachName, loadedAt: new Date().toISOString(), athletes: {} }
}

export function loadSession(): CombineSession {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptySession()
    const parsed = JSON.parse(raw) as CombineSession
    if (parsed.version !== 1 || !parsed.athletes) return emptySession()
    return reanalyze(parsed)
  } catch {
    return emptySession()
  }
}

export function saveSession(session: CombineSession): void {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function upsertExports(
  session: CombineSession,
  incoming: { sourceName: string; export: AthleteExport }[],
): CombineSession {
  const next: CombineSession = {
    ...session,
    loadedAt: new Date().toISOString(),
    athletes: { ...session.athletes },
  }
  for (const item of incoming) {
    const id = item.export.athlete.athlete_id
    const prev = next.athletes[id]
    const analysis: Analysis = analyzeAthlete(item.export, [])
    const record: AthleteRecord = {
      sourceName: item.sourceName,
      export: item.export,
      analysis,
      status: prev?.status === 'signed' && prev.export === item.export ? 'signed' : 'new',
    }
    if (prev && sameExport(prev.export, item.export) && prev.status === 'signed') {
      next.athletes[id] = { ...prev, sourceName: item.sourceName }
    } else if (prev && sameExport(prev.export, item.export)) {
      next.athletes[id] = { ...prev, sourceName: item.sourceName }
    } else {
      next.athletes[id] = record
    }
  }
  return reanalyze(next)
}

function sameExport(a: AthleteExport, b: AthleteExport): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function setCoachName(session: CombineSession, coachName: string): CombineSession {
  return { ...session, coachName }
}

export function setDraft(
  session: CombineSession,
  athleteId: string,
  draft: ReportDraft,
  letter: ReportDraft,
  meta: AthleteRecord['generateMeta'],
): CombineSession {
  const record = session.athletes[athleteId]
  if (!record || record.status === 'signed') return session
  return {
    ...session,
    athletes: {
      ...session.athletes,
      [athleteId]: { ...record, draft, letter, generateMeta: meta, status: 'draft' },
    },
  }
}

export function setLetter(session: CombineSession, athleteId: string, letter: ReportDraft): CombineSession {
  const record = session.athletes[athleteId]
  if (!record || record.status === 'signed') return session
  return {
    ...session,
    athletes: { ...session.athletes, [athleteId]: { ...record, letter } },
  }
}

export function signAthlete(session: CombineSession, athleteId: string): CombineSession {
  const record = session.athletes[athleteId]
  if (!record?.letter || !session.coachName.trim()) return session
  return {
    ...session,
    athletes: {
      ...session.athletes,
      [athleteId]: {
        ...record,
        status: 'signed',
        signedAt: new Date().toISOString(),
        signedBy: session.coachName.trim(),
      },
    },
  }
}

export function unlockAthlete(session: CombineSession, athleteId: string): CombineSession {
  const record = session.athletes[athleteId]
  if (!record) return session
  return {
    ...session,
    athletes: {
      ...session.athletes,
      [athleteId]: { ...record, status: record.letter ? 'draft' : 'new', signedAt: undefined, signedBy: undefined },
    },
  }
}

export function clearSession(coachName: string): CombineSession {
  const next = emptySession(coachName)
  saveSession(next)
  return next
}

export function roster(session: CombineSession): AthleteRecord[] {
  return Object.values(session.athletes).sort((a, b) =>
    a.export.athlete.name.localeCompare(b.export.athlete.name),
  )
}

export function attentionCount(record: AthleteRecord): number {
  return record.analysis.flags.filter(
    (flag) => flag.kind === 'skipped' || flag.kind === 'verify_outlier' || flag.kind === 'asymmetry' || flag.kind === 'quality',
  ).length
}
