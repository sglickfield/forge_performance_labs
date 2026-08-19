import { useEffect, useState } from 'react'
import type { CombineSession } from './domain/types'
import { loadSession, saveSession } from './persist/store'
import { Desk } from './ui/Desk'

export default function App() {
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
