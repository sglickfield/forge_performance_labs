import { useEffect, useState } from 'react'
import { shareTokenFromPath } from './domain/share'
import type { CombineSession } from './domain/types'
import { loadSession, saveSession } from './persist/store'
import { AthleteView } from './ui/AthleteView'
import { Desk } from './ui/Desk'

export default function App() {
  const token = shareTokenFromPath(window.location.pathname)
  if (token) return <AthleteView token={token} />
  return <CoachApp />
}

function CoachApp() {
  const [session, setSession] = useState<CombineSession>(() => loadSession())
  const [grokReady, setGrokReady] = useState<boolean | null>(null)

  useEffect(() => {
    saveSession(session)
  }, [session])

  useEffect(() => {
    void fetch('/api/status')
      .then((response) => response.json())
      .then((body: { grok?: boolean }) => setGrokReady(Boolean(body.grok)))
      .catch(() => setGrokReady(false))
  }, [])

  return <Desk session={session} onSession={setSession} grokReady={grokReady} />
}
