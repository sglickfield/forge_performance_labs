import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  listLatestExports,
  listSummaries,
  readExport,
  saveExport,
  SaveConflictError,
  type SaveMode,
} from './server/athleteStore.ts'
import { generateReport, type GenerateRequest } from './server/generateReport.ts'
import { classifyAgainstGold } from './server/scoreAgainstGold.ts'
import { normalizeDraft } from './src/domain/reportSchema.ts'
import { publishShare, readShare, unpublishShare } from './server/shareStore.ts'
import type { PublicLetter } from './src/domain/publicLetter.ts'

function forgeApiPlugin(apiKey: string | undefined) {
  return {
    name: 'forge-api',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(async (req: { method?: string; url?: string }, res: {
        statusCode: number
        setHeader: (k: string, v: string) => void
        end: (b?: string) => void
      }, next: () => void) => {
        if (!req.url?.startsWith('/api/')) {
          next()
          return
        }
        const path = req.url.split('?')[0] ?? ''
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'GET' && path === '/api/status') {
          res.end(JSON.stringify({ grok: Boolean(apiKey), model: 'grok-4.6' }))
          return
        }
        if (req.method === 'GET' && path === '/api/athletes') {
          res.end(JSON.stringify({ athletes: listSummaries() }))
          return
        }
        if (req.method === 'GET' && path === '/api/athletes/latest') {
          res.end(JSON.stringify({
            athletes: listLatestExports().map((item) => ({
              sourceName: item.sourceName,
              export: item.export,
              files: item.files,
            })),
          }))
          return
        }
        const fileMatch = path.match(/^\/api\/athletes\/([^/]+)\/([^/]+)$/)
        if (req.method === 'GET' && fileMatch) {
          try {
            const exp = readExport(decodeURIComponent(fileMatch[1]!), decodeURIComponent(fileMatch[2]!))
            res.end(JSON.stringify(exp))
          } catch (error) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Not found' }))
          }
          return
        }
        if (req.method === 'POST' && path === '/api/athletes') {
          try {
            const body = await readJson(req)
            const { payload, mode } = unwrapSaveBody(body)
            const saved = saveExport(payload, { mode })
            res.end(JSON.stringify(saved))
          } catch (error) {
            if (error instanceof SaveConflictError) {
              res.statusCode = 409
              res.end(JSON.stringify({
                conflict: true,
                identical: error.identical,
                athlete_id: error.athlete_id,
                tested_on: error.tested_on,
                athlete_name: error.athlete_name,
                filename: error.filename,
                error: error.message,
              }))
              return
            }
            res.statusCode = 400
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Bad request' }))
          }
          return
        }
        if (req.method === 'POST' && path === '/api/generate') {
          try {
            const body = await readJson(req)
            const result = await generateReport(body as GenerateRequest, apiKey)
            res.end(JSON.stringify(result))
          } catch (error) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Bad request' }))
          }
          return
        }
        if (req.method === 'POST' && path === '/api/confidence') {
          try {
            const body = await readJson(req)
            const items = Array.isArray((body as { items?: unknown }).items)
              ? (body as {
                  items: { athleteId?: unknown; athleteName?: unknown; draft?: unknown }[]
                }).items
              : []
            const scores: { athleteId: string; confidence: unknown }[] = []
            const missing: string[] = []
            for (const item of items) {
              if (typeof item.athleteId !== 'string' || typeof item.athleteName !== 'string') continue
              const draft = normalizeDraft(item.draft)
              if (!draft) continue
              const classified = await classifyAgainstGold(item.athleteName, draft)
              if (classified.goldStatus === 'missing') missing.push(item.athleteId)
              else scores.push({ athleteId: item.athleteId, confidence: classified.confidence })
            }
            res.end(JSON.stringify({ scores, missing }))
          } catch (error) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Bad request' }))
          }
          return
        }
        if (req.method === 'POST' && path === '/api/share') {
          try {
            const shared = publishShare((await readJson(req)) as PublicLetter)
            res.end(JSON.stringify({ token: shared.token, path: `/a/${shared.token}` }))
          } catch (error) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Bad request' }))
          }
          return
        }
        const shareMatch = path.match(/^\/api\/share\/([^/]+)$/)
        if (shareMatch) {
          const token = decodeURIComponent(shareMatch[1]!)
          if (req.method === 'GET') {
            try {
              res.end(JSON.stringify(readShare(token)))
            } catch {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Not found' }))
            }
            return
          }
          if (req.method === 'DELETE') {
            try {
              unpublishShare(token)
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Not found' }))
            }
            return
          }
        }
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Not found' }))
      })
    },
  }
}

function unwrapSaveBody(body: unknown): { payload: unknown; mode: SaveMode } {
  if (typeof body === 'object' && body !== null && 'export' in body) {
    const wrapped = body as { export: unknown; mode?: unknown }
    const mode = wrapped.mode === 'replace' || wrapped.mode === 'copy' ? wrapped.mode : 'new'
    return { payload: wrapped.export, mode }
  }
  return { payload: body, mode: 'new' }
}

function readJson(req: unknown): Promise<unknown> {
  const incoming = req as { on: (e: string, fn: (c?: Buffer) => void) => void }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    incoming.on('data', (chunk) => {
      if (chunk) chunks.push(chunk)
    })
    incoming.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    incoming.on('error', reject)
  })
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), forgeApiPlugin(env.XAI_API_KEY || process.env.XAI_API_KEY)],
    server: {
      allowedHosts: true,
    },
  }
})
