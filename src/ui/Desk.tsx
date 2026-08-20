import { useMemo, useState } from 'react'
import { confidenceLabel } from '../domain/confidence'
import { factCheck } from '../domain/factCheck'
import { ParseError, parseAthleteExport, parseAthleteFile } from '../domain/parseAthlete'
import { SAMPLE_FILES } from '../domain/samples'
import { emptyDraft } from '../domain/reportSchema'
import type { AthleteExport, AthleteRecord, CombineSession, ReportDraft } from '../domain/types'
import {
  attentionCount,
  clearSession,
  roster,
  setCoachName,
  setDraft,
  setLetter,
  signAthlete,
  unlockAthlete,
  upsertExports,
} from '../persist/store'
import { ReportLetter } from './ReportLetter'

const BAND_COPY: Record<string, string> = {
  above: 'above typical',
  typical: 'typical',
  below: 'below typical',
  skipped: 'not tested',
  unbenchmarked: 'no handbook range',
}

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

  const selected = athletes.find((row) => row.export.athlete.athlete_id === selectedId) ?? athletes[0]

  async function loadSamples() {
    setError(null)
    try {
      const incoming: { sourceName: string; export: AthleteExport }[] = []
      for (const name of SAMPLE_FILES) {
        const response = await fetch(`/samples/athletes/${name}`)
        if (!response.ok) throw new Error(`Could not load ${name}`)
        incoming.push({ sourceName: name, export: parseAthleteExport(await response.json()) })
      }
      const next = upsertExports(session, incoming)
      onSession(next)
      setSelectedId(incoming[0]?.export.athlete.athlete_id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the sample combine')
    }
  }

  async function ingestFiles(files: FileList | File[]) {
    setError(null)
    const incoming: { sourceName: string; export: AthleteExport }[] = []
    try {
      for (const file of Array.from(files)) {
        incoming.push({ sourceName: file.name, export: await parseAthleteFile(file) })
      }
      const next = upsertExports(session, incoming)
      onSession(next)
      setSelectedId(incoming[incoming.length - 1]?.export.athlete.athlete_id ?? selectedId)
    } catch (err) {
      setError(err instanceof ParseError ? err.message : 'Could not read that file')
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

  return (
    <div className="desk">
      <header className="topbar">
        <div className="mark">
          <div className="lab">
            Forge <em>Monday desk</em>
          </div>
          <div className="sub">Coach report writer · July combine week</div>
        </div>
        <div className="topbar-right">
          <label className="signing">
            Signing as
            <input
              value={session.coachName}
              placeholder="Your name"
              onChange={(event) => onSession(setCoachName(session, event.target.value))}
            />
          </label>
          {athletes.length > 0 ? (
            <button type="button" className="ghost" onClick={() => document.getElementById('file')?.click()}>
              Add athlete file
            </button>
          ) : null}
        </div>
      </header>

      <div className="workspace">
        {athletes.length > 0 ? (
          <aside className="roster">
            <h2>
              This week · {athletes.length} · {athletes.filter((row) => row.status === 'signed').length} signed
            </h2>
            {athletes.map((row) => {
              const id = row.export.athlete.athlete_id
              const hot = attentionCount(row)
              return (
                <button
                  key={id}
                  type="button"
                  className={selected?.export.athlete.athlete_id === id ? 'row active' : 'row'}
                  onClick={() => setSelectedId(id)}
                >
                  <div className="row-name">
                    <span>{row.export.athlete.name}</span>
                    <span className={row.status === 'signed' ? 'pill ok' : hot ? 'pill hot' : 'pill'}>
                      {row.status === 'signed' ? 'signed' : hot ? `${hot} flags` : row.status}
                    </span>
                  </div>
                  <div className="row-meta">{row.export.athlete.sport}</div>
                </button>
              )
            })}
          </aside>
        ) : (
          <aside className="roster">
            <h2>No combine loaded</h2>
          </aside>
        )}

        <main className="stage">
          {error ? <p className="warn" style={{ padding: '16px 28px 0' }}>{error}</p> : null}

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
                <button type="button" className="ghost" onClick={() => document.getElementById('file')?.click()}>
                  Drop in export files
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
              onSign={() => onSession(signAthlete(session, selected.export.athlete.athlete_id))}
              onUnlock={() => onSession(unlockAthlete(session, selected.export.athlete.athlete_id))}
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
    </div>
  )
}

function parseSections(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const [heading, ...rest] = block.split('\n')
      return { heading: (heading ?? '').trim(), body: rest.join(' ').trim() }
    })
    .filter((section) => section.heading || section.body)
}

function AthletePane({
  session,
  selected,
  busy,
  coachNote,
  grokReady,
  onCoachNote,
  onGenerate,
  onLetter,
  onSign,
  onUnlock,
  onClear,
}: {
  session: CombineSession
  selected: AthleteRecord
  busy: boolean
  coachNote: string
  grokReady: boolean | null
  onCoachNote: (value: string) => void
  onGenerate: () => void
  onLetter: (letter: ReportDraft) => void
  onSign: () => void
  onUnlock: () => void
  onClear: () => void
}) {
  const athlete = selected.export.athlete
  const letter = selected.letter ?? selected.draft ?? emptyDraft()
  const locked = selected.status === 'signed'
  const issues = selected.letter ? factCheck(selected.analysis, selected.letter) : []

  function patch<K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) {
    onLetter({ ...letter, [key]: value })
  }

  return (
    <section className="athlete">
      <div className="identity">
        <div>
          <h1>{athlete.name}</h1>
          <p className="who">
            {athlete.sport} · {athlete.age}
            {athlete.sex} · {athlete.tested_on} · {selected.export.administration.facility} ·{' '}
            {selected.export.administration.administered_by}
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="solid" disabled={busy || locked} onClick={onGenerate}>
            {busy ? 'Writing…' : selected.draft ? 'Redraft' : 'Draft the report'}
          </button>
          <button type="button" className="ghost" onClick={() => window.print()}>
            Print / PDF
          </button>
          <button type="button" className="danger" onClick={onClear}>
            Clear week
          </button>
        </div>
      </div>

      <div className="scores">
        {selected.analysis.tests.map((test) => (
          <div key={test.subtest} className={`score ${test.band}`}>
            <div className="k">{test.label}</div>
            <div className="v">{test.raw === null ? '—' : test.raw}</div>
            <div className="b">
              {BAND_COPY[test.band]}
              {test.range ? ` · ${test.range.lo}–${test.range.hi}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="split">
        <div className="letter-wrap">
          <ReportLetter record={selected} letter={letter} coachName={session.coachName} />
          {!locked ? (
            <div className="edit-block">
              <label htmlFor="headline">Edit the report before you sign</label>
              <input
                id="headline"
                type="text"
                value={letter.headline}
                onChange={(event) => patch('headline', event.target.value)}
              />
              <textarea
                rows={5}
                value={letter.overview}
                onChange={(event) => patch('overview', event.target.value)}
              />
              <textarea
                rows={6}
                value={letter.takeaways.map((section) => `${section.heading}\n${section.body}`).join('\n\n')}
                onChange={(event) => patch('takeaways', parseSections(event.target.value))}
              />
              <textarea
                rows={8}
                value={letter.recommendations
                  .map((section) => `${section.heading}\n${section.body}`)
                  .join('\n\n')}
                onChange={(event) => patch('recommendations', parseSections(event.target.value))}
              />
              <textarea
                rows={3}
                value={letter.caveats.join('\n')}
                onChange={(event) => patch('caveats', event.target.value.split('\n'))}
              />
            </div>
          ) : null}
        </div>

        <aside className="rail">
          {selected.generateMeta?.confidence ? (
            <div className={`card confidence ${selected.generateMeta.confidence.band}`}>
              <h3>Confidence vs gold letter</h3>
              <p className="confidence-band">{confidenceLabel(selected.generateMeta.confidence.band)}</p>
              <p className="meta">
                Cosine {selected.generateMeta.confidence.score.toFixed(3)} against this athlete’s
                golden dataset PDF. High ≥ 0.80 · medium 0.70–0.79 · low &lt; 0.70.
              </p>
            </div>
          ) : selected.letter ? (
            <div className="card">
              <h3>Confidence vs gold letter</h3>
              <p className="meta">No golden PDF for this athlete — score shows after a draft when a match exists in golden_datasets/.</p>
            </div>
          ) : null}
          <div className="card">
            <h3>Flags for you, not the athlete</h3>
            <div className="flags">
              {selected.analysis.flags.length === 0 ? (
                <p className="meta">Clean sheet. Light edit, then sign.</p>
              ) : (
                selected.analysis.flags.map((flag) => (
                  <div key={flag.text} className={`flag ${flag.kind}`}>
                    {flag.text}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3>Coach brief</h3>
            <p>{letter.coach_brief || 'Draft a letter to get the internal note.'}</p>
            {selected.generateMeta ? (
              <p className="meta" style={{ marginTop: 12 }}>
                {selected.generateMeta.source === 'grok' ? 'Grok draft' : 'Deterministic draft'} ·{' '}
                {selected.generateMeta.model} · {selected.generateMeta.promptVersion}
                {selected.generateMeta.warning ? <span className="warn"> · {selected.generateMeta.warning}</span> : null}
              </p>
            ) : (
              <p className="meta" style={{ marginTop: 12 }}>
                {grokReady
                  ? 'Live drafts use grok-4.6 on a fact pack, then a fact-check.'
                  : 'No API key — still drafts, from the same facts.'}
              </p>
            )}
          </div>

          <div className="card stack">
            <h3>Human in the loop</h3>
            <textarea
              rows={3}
              placeholder="Direction for a redraft — e.g. go easier on the sprint, mention the ankle in your own words."
              value={coachNote}
              disabled={locked}
              onChange={(event) => onCoachNote(event.target.value)}
            />
            <div className="row-actions" style={{ marginTop: 10 }}>
              {locked ? (
                <button type="button" className="ghost" onClick={onUnlock}>
                  Unlock
                </button>
              ) : (
                <button
                  type="button"
                  className="solid"
                  disabled={!session.coachName.trim() || !selected.letter}
                  onClick={onSign}
                >
                  Sign and lock
                </button>
              )}
            </div>
            {!session.coachName.trim() ? <p className="meta">Type your name in the top bar to sign.</p> : null}
            {issues.length > 0 ? (
              <div className="flags" style={{ marginTop: 12 }}>
                {issues.map((issue) => (
                  <div key={issue.code} className="flag verify_outlier">
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  )
}
