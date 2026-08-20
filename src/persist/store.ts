import { analyzeAthlete, sessionPullsFrom } from '../domain/analyze.ts'
import { normalizeDraft } from '../domain/reportSchema.ts'
import type {
  Analysis,
  AthleteExport,
  AthleteRecord,
  AthleteSlot,
  CoachVerdict,
  CombineFile,
  CombineSession,
  ReportDraft,
} from '../domain/types.ts'

const KEY = 'forge.combine.v2'
const LEGACY_KEY = 'forge.combine.v1'

export function fileLabel(file: CombineFile): string {
  const extra = file.filename.match(/__(\d+)\.json$/)
  return extra ? `${file.tested_on} (${extra[1]})` : file.tested_on
}

export function filenameOf(record: AthleteRecord): string {
  const fromSource = record.sourceName.split('/')[1]
  if (fromSource?.endsWith('.json')) return fromSource
  return `${record.export.athlete.tested_on}.json`
}

export function activeRecord(session: CombineSession, athleteId: string): AthleteRecord | undefined {
  const slot = session.athletes[athleteId]
  return slot?.records[slot.active]
}

function slotFromRecord(record: AthleteRecord, files?: CombineFile[]): AthleteSlot {
  const filename = filenameOf(record)
  const tested_on = record.export.athlete.tested_on
  return {
    files: files && files.length > 0 ? files : [{ tested_on, filename }],
    active: filename,
    records: { [filename]: record },
  }
}

function patchActive(
  session: CombineSession,
  athleteId: string,
  fn: (record: AthleteRecord) => AthleteRecord,
): CombineSession {
  const slot = session.athletes[athleteId]
  const record = slot?.records[slot.active]
  if (!slot || !record) return session
  return {
    ...session,
    athletes: {
      ...session.athletes,
      [athleteId]: {
        ...slot,
        records: { ...slot.records, [slot.active]: fn(record) },
      },
    },
  }
}

function reanalyze(session: CombineSession): CombineSession {
  const exports = Object.values(session.athletes)
    .map((slot) => slot.records[slot.active]?.export)
    .filter((exp): exp is AthleteExport => Boolean(exp))
  const pulls = sessionPullsFrom(exports)
  const athletes: CombineSession['athletes'] = {}
  for (const [id, slot] of Object.entries(session.athletes)) {
    const records: AthleteSlot['records'] = {}
    for (const [filename, record] of Object.entries(slot.records)) {
      records[filename] = {
        ...record,
        analysis: analyzeAthlete(record.export, filename === slot.active ? pulls : []),
        draft: normalizeDraft(record.draft),
        letter: normalizeDraft(record.letter),
      }
    }
    athletes[id] = { ...slot, records }
  }
  return { ...session, athletes }
}

export function emptySession(coachName = ''): CombineSession {
  return { version: 2, coachName, loadedAt: new Date().toISOString(), athletes: {} }
}

function migrate(raw: CombineSession & { version: number }): CombineSession {
  if (raw.version === 2) return raw
  const athletes: CombineSession['athletes'] = {}
  for (const [id, value] of Object.entries(raw.athletes as unknown as Record<string, AthleteRecord>)) {
    athletes[id] = slotFromRecord(value)
  }
  return { version: 2, coachName: raw.coachName, loadedAt: raw.loadedAt, athletes }
}

export function loadSession(): CombineSession {
  try {
    const fromLegacy = !localStorage.getItem(KEY) && Boolean(localStorage.getItem(LEGACY_KEY))
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return emptySession()
    const parsed = JSON.parse(raw) as CombineSession & { version: number }
    if (!parsed.athletes) return emptySession()
    const session = reanalyze(migrate(parsed))
    if (fromLegacy) localStorage.removeItem(LEGACY_KEY)
    return session
  } catch {
    return emptySession()
  }
}

export function saveSession(session: CombineSession): void {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function upsertExports(
  session: CombineSession,
  incoming: { sourceName: string; export: AthleteExport; files?: CombineFile[] }[],
): CombineSession {
  const next: CombineSession = {
    ...session,
    loadedAt: new Date().toISOString(),
    athletes: { ...session.athletes },
  }
  for (const item of incoming) {
    const id = item.export.athlete.athlete_id
    const filename = item.sourceName.split('/')[1] ?? `${item.export.athlete.tested_on}.json`
    const prevSlot = next.athletes[id]
    const prev = prevSlot?.records[filename]
    const analysis: Analysis = analyzeAthlete(item.export, [])
    const record: AthleteRecord = {
      sourceName: item.sourceName,
      export: item.export,
      analysis,
      status: prev?.status === 'signed' && prev.export === item.export ? 'signed' : 'new',
    }
    let stored = record
    if (prev && sameExport(prev.export, item.export) && prev.status === 'signed') {
      stored = { ...prev, sourceName: item.sourceName }
    } else if (prev && sameExport(prev.export, item.export)) {
      stored = { ...prev, sourceName: item.sourceName }
    }
    const files = mergeFiles(prevSlot?.files ?? [], item.files ?? [{ tested_on: item.export.athlete.tested_on, filename }])
    next.athletes[id] = {
      files,
      active: filename,
      records: { ...(prevSlot?.records ?? {}), [filename]: stored },
    }
  }
  return reanalyze(next)
}

function mergeFiles(current: CombineFile[], incoming: CombineFile[]): CombineFile[] {
  const byName = new Map<string, CombineFile>()
  for (const file of [...current, ...incoming]) byName.set(file.filename, file)
  return [...byName.values()].sort((a, b) => a.filename.localeCompare(b.filename))
}

export function applyFileLists(
  session: CombineSession,
  lists: { athlete_id: string; files: CombineFile[] }[],
): CombineSession {
  const athletes: CombineSession['athletes'] = { ...session.athletes }
  let changed = false
  for (const row of lists) {
    const slot = athletes[row.athlete_id]
    if (!slot) continue
    const files = mergeFiles(slot.files, row.files)
    if (files.length === slot.files.length && files.every((file, i) => file.filename === slot.files[i]?.filename)) {
      continue
    }
    athletes[row.athlete_id] = { ...slot, files }
    changed = true
  }
  return changed ? { ...session, athletes } : session
}

export function selectCombine(session: CombineSession, athleteId: string, filename: string): CombineSession {
  const slot = session.athletes[athleteId]
  if (!slot?.records[filename] || slot.active === filename) return session
  return reanalyze({
    ...session,
    athletes: {
      ...session.athletes,
      [athleteId]: { ...slot, active: filename },
    },
  })
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
  return patchActive(session, athleteId, (record) => {
    if (record.status === 'signed') return record
    return {
      ...record,
      draft,
      letter,
      generateMeta: meta,
      status: 'draft',
      coachRating: undefined,
    }
  })
}

export function setLetter(session: CombineSession, athleteId: string, letter: ReportDraft): CombineSession {
  return patchActive(session, athleteId, (record) => {
    if (record.status === 'signed') return record
    return { ...record, letter }
  })
}

export function signAthlete(
  session: CombineSession,
  athleteId: string,
  verdict?: CoachVerdict,
): CombineSession {
  const record = activeRecord(session, athleteId)
  if (!record?.letter || !session.coachName.trim()) return session
  return patchActive(session, athleteId, (current) => {
    const rated = verdict ? attachRating(current, verdict) : current
    return {
      ...rated,
      status: 'signed',
      signedAt: new Date().toISOString(),
      signedBy: session.coachName.trim(),
    }
  })
}

export function setShareToken(session: CombineSession, athleteId: string, shareToken: string): CombineSession {
  return patchActive(session, athleteId, (record) => ({ ...record, shareToken }))
}

export function rateAthlete(
  session: CombineSession,
  athleteId: string,
  verdict: CoachVerdict,
): CombineSession {
  return patchActive(session, athleteId, (record) => {
    if (!record.letter) return record
    return attachRating(record, verdict)
  })
}

function attachRating(record: AthleteRecord, verdict: CoachVerdict): AthleteRecord {
  return {
    ...record,
    coachRating: {
      verdict,
      ratedAt: new Date().toISOString(),
      promptVersion: record.generateMeta?.promptVersion ?? 'unknown',
      source: record.generateMeta?.source ?? 'template',
    },
  }
}

export function unlockAthlete(session: CombineSession, athleteId: string): CombineSession {
  return patchActive(session, athleteId, (record) => ({
    ...record,
    status: record.letter ? 'draft' : 'new',
    signedAt: undefined,
    signedBy: undefined,
    coachRating: undefined,
    shareToken: undefined,
  }))
}

export function clearSession(coachName: string): CombineSession {
  const next = emptySession(coachName)
  saveSession(next)
  return next
}

export function neighborFiles(session: CombineSession, athleteId: string): {
  files: CombineFile[]
  prev?: CombineFile
  next?: CombineFile
} {
  const slot = session.athletes[athleteId]
  if (!slot) return { files: [] }
  const index = slot.files.findIndex((file) => file.filename === slot.active)
  return {
    files: slot.files,
    prev: index > 0 ? slot.files[index - 1] : undefined,
    next: index >= 0 && index < slot.files.length - 1 ? slot.files[index + 1] : undefined,
  }
}

export function roster(session: CombineSession): AthleteRecord[] {
  return Object.values(session.athletes)
    .map((slot) => slot.records[slot.active])
    .filter((record): record is AthleteRecord => Boolean(record))
    .sort((a, b) => a.export.athlete.name.localeCompare(b.export.athlete.name))
}

export function attentionCount(record: AthleteRecord): number {
  return record.analysis.flags.filter(
    (flag) => flag.kind === 'skipped' || flag.kind === 'verify_outlier' || flag.kind === 'asymmetry' || flag.kind === 'quality',
  ).length
}
