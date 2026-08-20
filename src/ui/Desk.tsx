import { useEffect, useMemo, useRef, useState } from 'react'
import { ParseError, parseAthleteExport, parseAthleteFile } from '../domain/parseAthlete.ts'
import { publicLetterFrom } from '../domain/publicLetter.ts'
import type {
  AthleteExport,
  AthleteRecord,
  CombineFile,
  CombineSession,
  ReportDraft,
} from '../domain/types.ts'
import {
  activeRecord,
  applyFileLists,
  clearSession,
  rateAthlete,
  roster,
  selectCombine,
  setCoachName,
  setDraft,
  setLetter,
  setShareToken,
  signAthlete,
  unlockAthlete,
  upsertExports,
} from '../persist/store.ts'
import { AthletePane } from './AthletePane.tsx'

export function Desk({
  session,
  onSession,
  grokReady,
}: {
  session: CombineSession
  onSession: (next: CombineSession) => void
  grokReady: boolean | null
}) {
  const athletes = useMemo(() => roster(session), [session])
  const [selectedId, setSelectedId] = useState<string | null>(athletes[0]?.export.athlete.athlete_id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [coachNote, setCoachNote] = useState('')
  const [rosterOpen, setRosterOpen] = useState(false)
  const [conflict, setConflict] = useState<{
    export: AthleteExport
    identical: boolean
    athlete_id: string
    tested_on: string
    athlete_name: string
    filename: string
  } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const didHydrateFiles = useRef(false)

  function openUpload() {
    document.getElementById('file')?.click()
  }

  const selected = athletes.find((row) => row.export.athlete.athlete_id === selectedId) ?? athletes[0]

  async function hydrateFiles(base: CombineSession): Promise<CombineSession> {
    try {
      const response = await fetch('/api/athletes')
      if (!response.ok) return base
      const body = (await response.json()) as { athletes?: { athlete_id: string; files: CombineFile[] }[] }
      return applyFileLists(base, body.athletes ?? [])
    } catch {
      return base
    }
  }

  useEffect(() => {
    if (athletes.length === 0) {
      didHydrateFiles.current = false
      return
    }
    if (didHydrateFiles.current) return
    didHydrateFiles.current = true
    const current = session
    void hydrateFiles(current).then((next) => {
      if (next !== current) onSession(next)
    })
  }, [athletes.length, onSession, session])

  async function loadSamples() {
    setError(null)
    try {
      const response = await fetch('/api/athletes/latest')
      if (!response.ok) throw new Error('Could not load athletes from data/')
      const body = (await response.json()) as {
        athletes?: { sourceName: string; export: AthleteExport; files?: CombineFile[] }[]
      }
      const incoming = (body.athletes ?? []).map((row) => ({
        sourceName: row.sourceName,
        export: parseAthleteExport(row.export),
        files: row.files,
      }))
      if (incoming.length === 0) throw new Error('No athlete files in data/athletes/')
      const next = await hydrateFiles(upsertExports(session, incoming))
      onSession(next)
      setSelectedId(incoming[0]?.export.athlete.athlete_id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the sample combine')
    }
  }

  async function postExport(exp: AthleteExport, mode: 'new' | 'replace' | 'copy' = 'new') {
    const response = await fetch('/api/athletes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ export: exp, mode }),
    })
    const body = (await response.json()) as {
      error?: string
      conflict?: boolean
      identical?: boolean
      athlete_id?: string
      tested_on?: string
      athlete_name?: string
      filename?: string
      action?: 'created' | 'replaced' | 'copied'
      export?: AthleteExport
    }
    return { ok: response.ok, status: response.status, body }
  }

  function commitUpload(exp: AthleteExport, filename: string, action: 'created' | 'replaced' | 'copied' | 'loaded') {
    const next = upsertExports(session, [{ sourceName: `${exp.athlete.athlete_id}/${filename}`, export: exp }])
    void hydrateFiles(next).then(onSession)
    setSelectedId(exp.athlete.athlete_id)
    const who = `${exp.athlete.name} (${exp.athlete.tested_on})`
    if (action === 'created') setNotice(`Saved ${who} as ${exp.athlete.athlete_id}/${filename}.`)
    else if (action === 'replaced') setNotice(`Replaced ${exp.athlete.athlete_id}/${filename}.`)
    else if (action === 'copied') setNotice(`Kept both. New file is ${exp.athlete.athlete_id}/${filename}.`)
    else setNotice(`${who} is already on disk. Loaded it.`)
  }

  async function ingestFiles(files: FileList | File[]) {
    setError(null)
    setNotice(null)
    setConflict(null)
    try {
      for (const file of Array.from(files)) {
        const parsed = await parseAthleteFile(file)
        const result = await postExport(parsed)
        if (result.status === 409 && result.body.conflict) {
          setConflict({
            export: parsed,
            identical: Boolean(result.body.identical),
            athlete_id: result.body.athlete_id ?? parsed.athlete.athlete_id,
            tested_on: result.body.tested_on ?? parsed.athlete.tested_on,
            athlete_name: result.body.athlete_name ?? parsed.athlete.name,
            filename: result.body.filename ?? `${parsed.athlete.tested_on}.json`,
          })
          return
        }
        if (!result.ok || !result.body.athlete_id || !result.body.filename) {
          throw new Error(result.body.error || `Could not save ${file.name}`)
        }
        commitUpload(parsed, result.body.filename, result.body.action ?? 'created')
      }
    } catch (err) {
      setError(err instanceof ParseError ? err.message : err instanceof Error ? err.message : 'Could not read that file')
    }
  }

  async function resolveConflict(mode: 'replace' | 'copy' | 'skip') {
    if (!conflict) return
    const pending = conflict
    setConflict(null)
    if (mode === 'skip') {
      commitUpload(pending.export, pending.filename, 'loaded')
      return
    }
    try {
      const result = await postExport(pending.export, mode)
      if (!result.ok || !result.body.filename) {
        throw new Error(result.body.error || 'Could not save that file')
      }
      commitUpload(
        pending.export,
        result.body.filename,
        result.body.action ?? (mode === 'copy' ? 'copied' : 'replaced'),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that file')
    }
  }

  async function generate() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: selected.analysis,
          coachName: session.coachName,
          coachNote,
        }),
      })
      const body = (await response.json()) as {
        draft?: ReportDraft
        meta?: AthleteRecord['generateMeta']
        error?: string
      }
      if (!response.ok || !body.draft) throw new Error(body.error || 'Generate failed')
      onSession(setDraft(session, selected.export.athlete.athlete_id, body.draft, structuredClone(body.draft), body.meta))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed')
    } finally {
      setBusy(false)
    }
  }

  async function signSelected() {
    if (!selected) return
    setError(null)
    const id = selected.export.athlete.athlete_id
    const next = signAthlete(session, id)
    const record = activeRecord(next, id)
    if (!record || record.status !== 'signed') {
      onSession(next)
      return
    }
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publicLetterFrom(record)),
      })
      const body = (await response.json()) as { token?: string; error?: string }
      if (!response.ok || !body.token) throw new Error(body.error || 'Share failed')
      onSession(setShareToken(next, id, body.token))
    } catch (err) {
      onSession(next)
      setError(
        err instanceof Error
          ? `Signed, but the athlete link could not be created. ${err.message}`
          : 'Signed, but the athlete link could not be created.',
      )
    }
  }

  async function unlockSelected() {
    if (!selected) return
    setError(null)
    if (selected.shareToken) {
      try {
        await fetch(`/api/share/${encodeURIComponent(selected.shareToken)}`, { method: 'DELETE' })
      } catch {
        setError('Unlocked locally; the old athlete link may still work until you restart the desk.')
      }
    }
    onSession(unlockAthlete(session, selected.export.athlete.athlete_id))
  }

  async function showCombine(filename: string) {
    if (!selected) return
    const id = selected.export.athlete.athlete_id
    const slot = session.athletes[id]
    if (slot?.records[filename]) {
      onSession(selectCombine(session, id, filename))
      return
    }
    setError(null)
    try {
      const response = await fetch(
        `/api/athletes/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`,
      )
      if (!response.ok) throw new Error('Could not load that combine')
      const exp = parseAthleteExport(await response.json())
      onSession(
        upsertExports(session, [
          { sourceName: `${id}/${filename}`, export: exp, files: slot?.files },
        ]),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that combine')
    }
  }

  return (
    <div className="desk">
      <header className="topbar">
        <div className="mark">
          <div className="lab">
            Forge <em>Monday desk</em>
          </div>
          <div className="sub">Coach report writer</div>
        </div>
        <div className="topbar-right">
          <button type="button" className="ghost" onClick={openUpload}>
            Upload JSON
          </button>
        </div>
      </header>

      <div className="workspace">
        {athletes.length > 0 ? (
          <>
            <button
              type="button"
              className={rosterOpen ? 'drawer-handle open' : 'drawer-handle'}
              aria-expanded={rosterOpen}
              onClick={() => setRosterOpen((open) => !open)}
            >
              Athletes · {athletes.length}
            </button>
            {rosterOpen ? (
              <button type="button" className="drawer-backdrop" aria-label="Close athlete list" onClick={() => setRosterOpen(false)} />
            ) : null}
            <aside className={rosterOpen ? 'roster drawer open' : 'roster drawer'}>
              <h2>
                This week · {athletes.filter((row) => row.status === 'signed').length} signed
              </h2>
              {athletes.map((row) => {
                const id = row.export.athlete.athlete_id
                return (
                  <button
                    key={id}
                    type="button"
                    className={selected?.export.athlete.athlete_id === id ? 'row active' : 'row'}
                    onClick={() => {
                      setSelectedId(id)
                      setRosterOpen(false)
                    }}
                  >
                    <div className="row-name">
                      <span>{row.export.athlete.name}</span>
                      <span className={row.status === 'signed' ? 'pill ok' : 'pill'}>{row.status}</span>
                    </div>
                    <div className="row-meta">
                      {row.export.athlete.sport} · {row.export.athlete.tested_on}
                    </div>
                  </button>
                )
              })}
              <div className="drawer-actions">
                <button type="button" className="ghost" onClick={openUpload}>
                  Upload JSON
                </button>
              </div>
            </aside>
          </>
        ) : null}

        <main className="stage">
          {error ? <p className="warn" style={{ padding: '16px 28px 0' }}>{error}</p> : null}
          {notice ? <p className="meta" style={{ padding: '16px 28px 0' }}>{notice}</p> : null}

          {athletes.length === 0 || !selected ? (
            <section
              className="empty"
              onDragOver={(event) => {
                event.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setOver(false)
                if (event.dataTransfer.files.length) void ingestFiles(event.dataTransfer.files)
              }}
            >
              <div className="eyebrow">Monday morning</div>
              <h1>
                Twelve athletes tested last week. <em>Most of them are still waiting on a letter.</em>
              </h1>
              <p className="lede">
                Load the combine. The desk reads the 2019 handbook, flags the messy sheets, and drafts something you would actually sign.
              </p>
              <div className="actions">
                <button type="button" className="solid" onClick={() => void loadSamples()}>
                  Load this week’s combine
                </button>
                <button type="button" className="ghost" onClick={openUpload}>
                  Upload JSON
                </button>
              </div>
              <div className={over ? 'drop over' : 'drop'}>
                Any athlete JSON in the Forge export format. New files arrive after every combine — add them while this is running.
                {grokReady === false ? ' No XAI_API_KEY in .env: drafts will use the deterministic writer.' : null}
                {grokReady ? ' Grok is on — drafts go through grok-4.6, then a fact-check.' : null}
              </div>
            </section>
          ) : (
            <AthletePane
              session={session}
              selected={selected}
              busy={busy}
              coachNote={coachNote}
              grokReady={grokReady}
              onCoachNote={setCoachNote}
              onGenerate={() => void generate()}
              onLetter={(letter) => onSession(setLetter(session, selected.export.athlete.athlete_id, letter))}
              onSign={() => void signSelected()}
              onRate={(verdict) =>
                onSession(rateAthlete(session, selected.export.athlete.athlete_id, verdict))
              }
              onUnlock={() => void unlockSelected()}
              onCoachName={(name) => onSession(setCoachName(session, name))}
              onSelectCombine={(filename) => void showCombine(filename)}
              onClear={() => {
                onSession(clearSession(session.coachName))
                setSelectedId(null)
              }}
            />
          )}
        </main>
      </div>

      <input
        id="file"
        type="file"
        accept="application/json,.json"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) void ingestFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {conflict ? (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="upload-conflict-title">
            <h2 id="upload-conflict-title">File already saved</h2>
            {conflict.identical ? (
              <p>
                {conflict.athlete_name} already has this exact combine on {conflict.tested_on} (
                {conflict.athlete_id}/{conflict.filename}). Replace it, or leave the copy on disk?
              </p>
            ) : (
              <p>
                {conflict.athlete_name} already has a combine on {conflict.tested_on} (
                {conflict.athlete_id}/{conflict.filename}), but the contents differ. Replace it, or keep
                both?
              </p>
            )}
            <div className="row-actions">
              <button type="button" className="solid" onClick={() => void resolveConflict('replace')}>
                Replace
              </button>
              {conflict.identical ? (
                <button type="button" className="ghost" onClick={() => void resolveConflict('skip')}>
                  Keep existing
                </button>
              ) : (
                <button type="button" className="ghost" onClick={() => void resolveConflict('copy')}>
                  Keep both
                </button>
              )}
              <button type="button" className="ghost" onClick={() => setConflict(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
