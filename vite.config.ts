// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function readBuildId(): string {
  try {
    return JSON.parse(readFileSync(new URL('./public/data/snapshot.json', import.meta.url), 'utf8')).buildId
  } catch {
    return 'dev'
  }
}

// Mounts the server function on the dev server, so local work needs no Vercel tooling.
// With MOCK_MODELS=1 it streams a canned answer and calls nothing.
function devApi(): Plugin {
  return {
    name: 'ember-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path !== '/api/ask' && path !== '/api/health') return next()
        try {
          const mod = await server.ssrLoadModule('/server/handler.ts')
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          })
          const env = { ...process.env, MOCK_MODELS: process.env.MOCK_MODELS ?? '1' }
          const response: Response = path === '/api/ask' ? await mod.handleAsk(request, env) : await mod.handleHealth(env)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (!response.body) return res.end()
          const reader = response.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
          res.end()
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: { code: 'dev_error', message: String(error) } }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  define: { __BUILD_ID__: JSON.stringify(readBuildId()) },
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
    testTimeout: 20000,
  },
})
