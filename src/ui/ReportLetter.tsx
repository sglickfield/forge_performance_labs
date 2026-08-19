import { formatRaw } from '../domain/analyze'
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
  const signedBy = record.signedBy || coachName
  return (
    <article className="letter">
      <header className="letter-head">
        <div className="lab">Forge Performance Labs</div>
        <div className="tiny">{record.export.administration.facility}</div>
      </header>
      <p className="tiny">
        Combine letter · {athlete.tested_on} · {athlete.athlete_id}
      </p>
      <h2>{letter.headline || `${athlete.name}`}</h2>
      <p className="to">{letter.greeting || `${athlete.name.split(' ')[0]} —`}</p>
      <p className="body">{letter.what_we_saw}</p>

      {letter.keep_doing.some((item) => item.trim()) ? (
        <>
          <h3>Keep this</h3>
          <ul>
            {letter.keep_doing.filter((item) => item.trim()).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {letter.focus_next.some((item) => item.trim()) ? (
        <>
          <h3>Focus next</h3>
          <ul>
            {letter.focus_next.filter((item) => item.trim()).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {letter.caveats.some((item) => item.trim()) ? (
        <>
          <h3>How to read this sheet</h3>
          <ul>
            {letter.caveats.filter((item) => item.trim()).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="close">{letter.signoff}</p>

      <div className="signature">
        <div className="name">{signedBy || '________________'}</div>
        <div className="role">
          Coach · Forge Performance Labs
          {record.signedAt ? ` · signed ${record.signedAt.slice(0, 10)}` : ' · unsigned draft'}
        </div>
        <div className="role">
          {athlete.sport} · {athlete.age}
          {athlete.sex} · mid-thigh pull{' '}
          {record.analysis.midthigh
            ? `${formatRaw(record.analysis.midthigh.raw, 'N')} · ${record.analysis.midthigh.rank}/${record.analysis.midthigh.of} this week`
            : 'not ranked'}
        </div>
      </div>
    </article>
  )
}
