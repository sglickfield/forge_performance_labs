import { type ReactNode } from 'react'
import { COACH_VERDICTS, letterWasEdited, verdictHint } from '../domain/coachRating.ts'
import { confidenceLabel } from '../domain/confidence.ts'
import { factCheck } from '../domain/factCheck.ts'
import { emptyDraft } from '../domain/reportSchema.ts'
import { athleteSharePath } from '../domain/publicLetter.ts'
import type { AthleteRecord, CoachVerdict, CombineSession, ReportDraft } from '../domain/types.ts'
import { fileLabel, neighborFiles } from '../persist/store.ts'
import { ReportComposer } from './ReportLetter.tsx'

const BAND_COPY: Record<string, string> = {
  above: 'above typical',
  typical: 'typical',
  below: 'below typical',
  skipped: 'not tested',
  unbenchmarked: 'no handbook range',
}

function field(label: string, control: ReactNode) {
  return (
    <>
      <div className="edit-label">{label}</div>
      {control}
    </>
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

export function AthletePane({
  session,
  selected,
  busy,
  coachNote,
  grokReady,
  onCoachNote,
  onGenerate,
  onLetter,
  onSign,
  onRate,
  onUnlock,
  onSelectCombine,
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
  onRate: (verdict: CoachVerdict) => void
  onUnlock: () => void
  onSelectCombine: (filename: string) => void
  onClear: () => void
}) {
  const athlete = selected.export.athlete
  const dates = neighborFiles(session, athlete.athlete_id)
  const letter = selected.letter ?? selected.draft ?? emptyDraft()
  const locked = selected.status === 'signed'
  const sharePath = selected.shareToken ? athleteSharePath(selected.shareToken) : null
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
            {athlete.sex} · {selected.export.administration.facility} ·{' '}
            {selected.export.administration.administered_by}
          </p>
          <div className="date-toggle">
            <button
              type="button"
              className="ghost"
              disabled={!dates.prev}
              onClick={() => dates.prev && onSelectCombine(dates.prev.filename)}
            >
              ‹
            </button>
            <span>
              {fileLabel(
                dates.files.find((file) => file.filename === session.athletes[athlete.athlete_id]?.active) ?? {
                  tested_on: athlete.tested_on,
                  filename: `${athlete.tested_on}.json`,
                },
              )}
            </span>
            <button
              type="button"
              className="ghost"
              disabled={!dates.next}
              onClick={() => dates.next && onSelectCombine(dates.next.filename)}
            >
              ›
            </button>
            {dates.files.length > 1 ? (
              <span className="meta">
                {dates.files.findIndex((file) => file.filename === session.athletes[athlete.athlete_id]?.active) + 1} of{' '}
                {dates.files.length}
              </span>
            ) : null}
          </div>
        </div>
        <div className="row-actions">
          <button type="button" className="solid" disabled={busy || locked} onClick={onGenerate}>
            {busy ? 'Writing…' : selected.draft ? 'Redraft' : 'Draft the report'}
          </button>
          <button type="button" className="ghost" onClick={() => window.print()}>
            Print / PDF
          </button>
          {locked && sharePath ? (
            <>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(`${window.location.origin}${sharePath}`)
                }}
              >
                Copy athlete link
              </button>
              <a className="ghost" href={sharePath} target="_blank" rel="noreferrer">
                Open athlete page
              </a>
            </>
          ) : null}
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

      <ReportComposer
        view={{
          athlete,
          administration: selected.export.administration,
          tests: selected.analysis.tests,
          ageBandLabel: selected.analysis.ageBandLabel,
          letter,
          signedBy: selected.signedBy || session.coachName,
          signedAt: selected.signedAt,
        }}
        edits={
          locked
            ? undefined
            : {
                headline: field(
                  'Headline',
                  <input
                    type="text"
                    value={letter.headline}
                    placeholder="Headline"
                    onChange={(event) => patch('headline', event.target.value)}
                  />,
                ),
                overview: field(
                  'Overview',
                  <textarea
                    value={letter.overview}
                    placeholder="Overview"
                    onChange={(event) => patch('overview', event.target.value)}
                  />,
                ),
                takeaways: field(
                  'Takeaways',
                  <textarea
                    value={letter.takeaways.map((section) => `${section.heading}\n${section.body}`).join('\n\n')}
                    placeholder={'Heading\nParagraph'}
                    onChange={(event) => patch('takeaways', parseSections(event.target.value))}
                  />,
                ),
                recommendations: field(
                  'Recommendations',
                  <textarea
                    value={letter.recommendations
                      .map((section) => `${section.heading}\n${section.body}`)
                      .join('\n\n')}
                    placeholder={'Heading\nParagraph'}
                    onChange={(event) => patch('recommendations', parseSections(event.target.value))}
                  />,
                ),
                caveats: field(
                  'Caveats',
                  <textarea
                    value={letter.caveats.join('\n')}
                    placeholder="One caveat per line"
                    onChange={(event) => patch('caveats', event.target.value.split('\n'))}
                  />,
                ),
              }
        }
      />

      <div className="hitl">
        <div className="hitl-main">
          <h3>Human in the loop</h3>
          <textarea
            rows={2}
            placeholder="Direction for a redraft — e.g. go easier on the sprint, mention the ankle in your own words."
            value={coachNote}
            disabled={locked}
            onChange={(event) => onCoachNote(event.target.value)}
          />
          {selected.letter ? (
            <div className="rating-block">
              <p className="meta">How close was this draft to something you would hand over?</p>
              <div className="choices" role="group" aria-label="Draft rating">
                {COACH_VERDICTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selected.coachRating?.verdict === item.id ? 'choice on' : 'choice'}
                    onClick={() => onRate(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {selected.coachRating ? (
                <p className="meta">{verdictHint(selected.coachRating.verdict)}</p>
              ) : (
                <p className="meta">Optional — rate before or after you sign.</p>
              )}
              {letterWasEdited(selected.draft, selected.letter) ? (
                <p className="meta">The letter text differs from the model draft.</p>
              ) : null}
            </div>
          ) : null}
          {issues.length > 0 ? (
            <div className="flags">
              {issues.map((issue) => (
                <div key={issue.code} className="flag verify_outlier">
                  {issue.message}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="hitl-side">
          {selected.generateMeta?.confidence ? (
            <p className={`confidence-inline ${selected.generateMeta.confidence.band}`}>
              {confidenceLabel(selected.generateMeta.confidence.band)} ·{' '}
              {selected.generateMeta.confidence.score.toFixed(3)}
            </p>
          ) : null}
          {selected.generateMeta ? (
            <p className="meta">
              {selected.generateMeta.source === 'grok' ? 'Grok' : 'Template'} · {selected.generateMeta.promptVersion}
              {selected.generateMeta.warning ? <span className="warn"> · {selected.generateMeta.warning}</span> : null}
            </p>
          ) : grokReady ? (
            <p className="meta">Live drafts use grok-4.6, then a fact-check.</p>
          ) : (
            <p className="meta">No API key — still drafts from the same facts.</p>
          )}
          <div className="row-actions">
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
        </div>
      </div>
    </section>
  )
}
