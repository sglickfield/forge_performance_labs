import type { ReactNode } from 'react'
import { interpretation, rangeLabel, ratingLabel, resultLabel } from '../domain/bandLabels.ts'
import type { Administration, AthleteIdentity, ReportDraft, TestView } from '../domain/types.ts'

export interface LetterView {
  athlete: AthleteIdentity
  administration: Administration
  tests: TestView[]
  ageBandLabel: string
  letter: ReportDraft
  signedBy: string
  signedAt?: string
}

export interface LetterEdits {
  headline: ReactNode
  overview: ReactNode
  takeaways: ReactNode
  recommendations: ReactNode
  caveats: ReactNode
}

export function ReportLetter(view: LetterView) {
  return (
    <article className="letter">
      <LetterMasthead {...view} />
      <LetterHeadline {...view} />
      <LetterOverview {...view} />
      <LetterResults {...view} />
      <LetterTakeaways {...view} />
      <LetterRecommendations {...view} />
      <LetterClose {...view} />
    </article>
  )
}

export function ReportComposer({ view, edits }: { view: LetterView; edits?: LetterEdits }) {
  if (!edits) {
    return (
      <div className="letter-wrap">
        <ReportLetter {...view} />
      </div>
    )
  }

  return (
    <div className="composer">
      <article className="letter letter-wrap">
        <div className="letter-band band-meta">
          <LetterMasthead {...view} />
        </div>
        <div className="letter-band band-headline">
          <LetterHeadline {...view} keep />
        </div>
        <div className="letter-band band-overview">
          <LetterOverview {...view} />
        </div>
        <div className="letter-band band-results">
          <LetterResults {...view} />
        </div>
        <div className="letter-band band-takeaways">
          <LetterTakeaways {...view} />
        </div>
        <div className="letter-band band-recs">
          <LetterRecommendations {...view} />
        </div>
        <div className="letter-band band-caveats">
          <LetterCaveats {...view} />
        </div>
        <div className="letter-band band-close">
          <LetterSignoff {...view} />
        </div>
      </article>
      <aside className="edit-rail">
        <div className="edit-slot edit-meta" />
        <div className="edit-slot edit-headline">{edits.headline}</div>
        <div className="edit-slot edit-overview">{edits.overview}</div>
        <div className="edit-slot edit-results" />
        <div className="edit-slot edit-takeaways">{edits.takeaways}</div>
        <div className="edit-slot edit-recs">{edits.recommendations}</div>
        <div className="edit-slot edit-caveats">{edits.caveats}</div>
        <div className="edit-slot edit-close" />
      </aside>
    </div>
  )
}

function LetterMasthead({ athlete, administration }: LetterView) {
  const sexWord = athlete.sex === 'F' ? 'Female' : 'Male'
  return (
    <>
      <header className="letter-head report">
        <div>
          <div className="report-kicker">Forge Performance Labs</div>
          <h1>Athlete combine performance report</h1>
          <p className="subhead">
            Field testing summary compared with Forge Coach Handbook (2019) benchmarks
          </p>
        </div>
      </header>
      <table className="id-table">
        <tbody>
          <tr>
            <td>
              <strong>{athlete.name}</strong>
            </td>
            <td>ID: {athlete.athlete_id}</td>
            <td>
              Age {athlete.age} · {sexWord}
            </td>
          </tr>
          <tr>
            <td>Sport: {athlete.sport}</td>
            <td>Tested: {athlete.tested_on}</td>
            <td>{administration.facility}</td>
          </tr>
        </tbody>
      </table>
      <p className="admin-line">
        Administered by {administration.administered_by}
        {administration.conditions_note
          ? ` · Conditions: ${administration.conditions_note}`
          : ' · Conditions: standard indoor testing environment'}
      </p>
    </>
  )
}

function LetterHeadline({ letter, keep }: LetterView & { keep?: boolean }) {
  if (!letter.headline && !keep) return null
  return <p className="headline-line">{letter.headline || '\u00a0'}</p>
}

function LetterOverview({ letter }: LetterView) {
  return (
    <>
      <h2>Performance overview</h2>
      <p className="body">{letter.overview}</p>
    </>
  )
}

function LetterResults({ athlete, tests, ageBandLabel }: LetterView) {
  return (
    <>
      <h2>Detailed results vs. benchmarks</h2>
      <table className="results-table">
        <thead>
          <tr>
            <th>Test</th>
            <th>Result</th>
            <th>
              Typical range ({athlete.sex}, {ageBandLabel})
            </th>
            <th>Rating</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.subtest}>
              <td>{test.label}</td>
              <td>
                <strong>{resultLabel(test)}</strong>
              </td>
              <td>{rangeLabel(test)}</td>
              <td>
                <span className={`rating ${test.band}`}>{ratingLabel(test)}</span>
              </td>
              <td>{interpretation(test)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tests.some((test) => test.subtest === 'midthigh_pull_n') ? (
        <p className="table-note">
          Mid-thigh pull (isometric force) is not covered in the 2019 handbook; the recorded value is
          provided for longitudinal tracking.
        </p>
      ) : null}
    </>
  )
}

function LetterTakeaways({ letter }: LetterView) {
  return (
    <>
      <h2>Key takeaways</h2>
      {letter.takeaways.length ? (
        letter.takeaways.map((section) => (
          <p key={section.heading} className="body">
            <strong>{section.heading}. </strong>
            {section.body}
          </p>
        ))
      ) : (
        <p className="body meta">No takeaways yet.</p>
      )}
    </>
  )
}

function LetterRecommendations({ letter }: LetterView) {
  return (
    <>
      <h2>Coaching recommendations</h2>
      {letter.recommendations.length ? (
        letter.recommendations.map((section) => (
          <p key={section.heading} className="body">
            <strong>{section.heading}: </strong>
            {section.body}
          </p>
        ))
      ) : (
        <p className="body meta">No recommendations yet.</p>
      )}
    </>
  )
}

function LetterCaveats({ letter }: LetterView) {
  return (
    <>
      <h2>How to read this sheet</h2>
      {letter.caveats.some((item) => item.trim()) ? (
        <ul>
          {letter.caveats.filter((item) => item.trim()).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="body meta">No caveats.</p>
      )}
    </>
  )
}

function LetterSignoff({ administration, letter, signedBy, signedAt }: LetterView) {
  return (
    <>
      <p className="disclaimer">
        This report is intended for coaching and athlete development. Benchmarks are drawn from the
        Forge Coach Handbook (2019 edition), Appendix C, and represent typical ranges for
        recreational-to-competitive adult athletes — not elite or sport-specific norms. Individual
        context (training history, recent fatigue, technical factors) should always inform
        interpretation.
      </p>
      <div className="signature">
        <div className="name">{signedBy || '________________'}</div>
        <div className="role">
          Coach · Forge Performance Labs
          {signedAt ? ` · signed ${signedAt.slice(0, 10)}` : ' · unsigned draft'}
        </div>
        <div className="role">
          {letter.headline ? `${letter.headline} · ` : ''}
          {administration.facility} · Confidential athlete data
        </div>
      </div>
    </>
  )
}

function LetterClose(view: LetterView) {
  return (
    <>
      <LetterCaveats {...view} />
      <LetterSignoff {...view} />
    </>
  )
}
