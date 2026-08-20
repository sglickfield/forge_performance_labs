import { useEffect, useState } from 'react'
import { athleteSharePath, type SharedLetter } from '../domain/share'
import { ReportLetter } from './ReportLetter'

export function AthleteView({ token }: { token: string }) {
  const [letter, setLetter] = useState<SharedLetter | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/share/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('missing')
        return (await response.json()) as SharedLetter
      })
      .then((body) => {
        if (cancelled) return
        setLetter(body)
        document.title = `${body.athlete.name} · Forge combine report`
      })
      .catch(() => {
        if (!cancelled) setMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (missing) {
    return (
      <main className="athlete-page">
        <div className="missing">
          <div className="eyebrow">Forge Performance Labs</div>
          <h1>This report isn’t available.</h1>
          <p className="lede">Ask your coach for a new link if you still need the letter.</p>
        </div>
      </main>
    )
  }

  if (!letter) {
    return (
      <main className="athlete-page">
        <div className="missing">
          <p className="lede">Loading your report…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="athlete-page">
      <div className="letter-wrap">
        <ReportLetter
          athlete={letter.athlete}
          administration={letter.administration}
          tests={letter.tests}
          ageBandLabel={letter.ageBandLabel}
          letter={letter.letter}
          signedBy={letter.signedBy}
          signedAt={letter.signedAt}
        />
      </div>
      <p className="athlete-foot meta">
        Your coach shared this letter with you.
        <a href={athleteSharePath(token)}> Permalink</a>
      </p>
    </main>
  )
}
