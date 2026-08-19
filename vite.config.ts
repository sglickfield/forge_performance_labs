import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
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
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'GET' && req.url === '/api/status') {
          res.end(JSON.stringify({ grok: Boolean(apiKey), model: 'grok-4.6' }))
          return
        }
        if (req.method === 'POST' && req.url === '/api/generate') {
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
