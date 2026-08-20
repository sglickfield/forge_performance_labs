import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { listLatestExports, listSummaries, readExport, saveExport } from './server/athleteStore.ts'
import { generateReport, type GenerateRequest } from './server/generateReport.ts'

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
            const saved = saveExport(body)
            res.end(JSON.stringify(saved))
          } catch (error) {
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
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Not found' }))
      })
    },
  }
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
  }
})
