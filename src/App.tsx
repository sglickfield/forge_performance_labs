import { useEffect, useState } from 'react'
import { shareTokenFromPath } from './domain/publicLetter.ts'
import type { CombineSession } from './domain/types.ts'
import { loadSession, saveSession } from './persist/store.ts'
import { AthleteView } from './ui/AthleteView.tsx'
import { Desk } from './ui/Desk.tsx'

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
