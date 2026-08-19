import { interpretation, rangeLabel, ratingLabel, resultLabel } from '../domain/ratings'
import type { AthleteRecord, ReportDraft } from '../domain/types'

export function ReportLetter({
  record,
  letter,
  coachName,
}: {
  record: AthleteRecord
  letter: ReportDraft
  coachName: string
}) {
  const athlete = record.export.athlete
  const admin = record.export.administration
  const signedBy = record.signedBy || coachName
  const sexWord = athlete.sex === 'F' ? 'Female' : 'Male'

  return (
    <article className="letter">
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
            <td>{admin.facility}</td>
          </tr>
        </tbody>
      </table>
      <p className="admin-line">
        Administered by {admin.administered_by}
        {admin.conditions_note ? ` · Conditions: ${admin.conditions_note}` : ' · Conditions: standard indoor testing environment'}
      </p>

      <h2>Performance overview</h2>
      <p className="body">{letter.overview}</p>

      <h2>Detailed results vs. benchmarks</h2>
      <table className="results-table">
        <thead>
          <tr>
            <th>Test</th>
            <th>Result</th>
            <th>Typical range ({athlete.sex}, {record.analysis.ageBandLabel})</th>
            <th>Rating</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {record.analysis.tests.map((test) => (
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
      {record.analysis.tests.some((test) => test.subtest === 'midthigh_pull_n') ? (
        <p className="table-note">
          Mid-thigh pull (isometric force) is not covered in the 2019 handbook; the recorded value is
          provided for longitudinal tracking.
        </p>
      ) : null}

      {letter.takeaways.length ? (
        <>
          <h2>Key takeaways</h2>
          {letter.takeaways.map((section) => (
            <p key={section.heading} className="body">
              <strong>{section.heading}. </strong>
              {section.body}
            </p>
          ))}
        </>
      ) : null}

      {letter.recommendations.length ? (
        <>
          <h2>Coaching recommendations</h2>
          {letter.recommendations.map((section) => (
            <p key={section.heading} className="body">
              <strong>{section.heading}: </strong>
              {section.body}
            </p>
          ))}
        </>
      ) : null}

      {letter.caveats.some((item) => item.trim()) ? (
        <>
          <h2>How to read this sheet</h2>
          <ul>
            {letter.caveats.filter((item) => item.trim()).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

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
          {record.signedAt ? ` · signed ${record.signedAt.slice(0, 10)}` : ' · unsigned draft'}
        </div>
        <div className="role">
          {letter.headline ? `${letter.headline} · ` : ''}
          {admin.facility} · Confidential athlete data
        </div>
      </div>
    </article>
  )
}
