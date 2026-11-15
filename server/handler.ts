// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The whole request flow as one function, so the tests and the dev server run the same code as Vercel.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EvidenceBundle, EvidenceItem, SearchIndexFile } from '../src/types.ts'
import { RATE_MESSAGE, createRateLimiter } from '../src/lib/rateLimit.ts'
import type { RateLimiter } from '../src/lib/rateLimit.ts'
import { TOPIC_HINT, buildTopicVocab, screenQuestion } from '../src/lib/topic.ts'
import type { TopicVocab } from '../src/lib/topic.ts'
import { runChain } from './chain.ts'
import { CONFIG, REFUSAL } from './config.ts'
import type { Env } from './config.ts'
import { buildMessages } from './prompt.ts'
import { sseComment, sseEvent } from './sse.ts'
import { isEvidenceId, validateBody } from './validate.ts'

type FetchLike = (input: string, init: RequestInit) => Promise<Response>
export type Deps = {
  fetchImpl?: FetchLike
  bundle?: EvidenceBundle
  search?: SearchIndexFile
  log?: (line: string) => void
  timers?: Parameters<typeof runChain>[0]['timers']
  // null turns the question limit off, for tests of other parts.
  limiter?: RateLimiter | null
}

let cached: EvidenceBundle | null = null
let vocabCache: { file: SearchIndexFile; vocab: TopicVocab } | null = null
// One memory per running instance. Vercel may run several, so this is a best effort and not a hard stop.
const sharedLimiter = createRateLimiter()

// The function reads the same evidence file the site serves. There is no second copy.
export function loadBundle(): EvidenceBundle {
  if (!cached) cached = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'evidence.json'), 'utf8')) as EvidenceBundle
  return cached
}

// The topic words come from the same search file the site serves.
// If that file cannot be read, the fixed word lists in topic.ts still hold the screen.
function readSearchIndex(): SearchIndexFile {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'search-index.json'), 'utf8')) as SearchIndexFile
  } catch {
    return { docs: [], aliases: {} } as unknown as SearchIndexFile
  }
}

function topicVocab(search?: SearchIndexFile): TopicVocab {
  const file = search ?? vocabCache?.file ?? readSearchIndex()
  if (!vocabCache || vocabCache.file !== file) vocabCache = { file, vocab: buildTopicVocab(file) }
  return vocabCache.vocab
}

const json = (status: number, code: string, message: string, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify({ error: { code, message } }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })

// A browser sends Origin on every POST. Without it, Sec-Fetch-Site or Referer must say the request
// came from this site. A request with none of the three is refused. A script can still fake these
// headers, so this stops casual reuse only. The question limit and the key's daily limit do the rest.
export function fromOwnSite(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host
  const sameHost = (value: string): boolean => {
    try {
      return new URL(value).host === host
    } catch {
      return false
    }
  }
  const origin = request.headers.get('origin')
  if (origin) return sameHost(origin)
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite) return fetchSite === 'same-origin'
  const referer = request.headers.get('referer')
  if (referer) return sameHost(referer)
  return false
}

// The visitor's address. Vercel sets x-real-ip and x-forwarded-for itself and replaces any value the visitor sent.
export function clientKey(request: Request): string {
  const h = request.headers
  const raw = h.get('x-real-ip') || h.get('x-vercel-forwarded-for') || h.get('x-forwarded-for') || 'unknown'
  return raw.split(',')[0].trim().slice(0, 64) || 'unknown'
}

// Keeps only ids that match the pattern and exist in the bundle, without duplicates.
// Drops ids from the end until the evidence text is under the cap.
export function pickEvidence(ids: string[], bundle: EvidenceBundle): EvidenceItem[] {
  const seen = new Set<string>()
  const items: EvidenceItem[] = []
  for (const id of ids) {
    if (!isEvidenceId(id) || id === 'S' || seen.has(id)) continue
    const item = bundle.items[id]
    if (!item) continue
    seen.add(id)
    items.push(item)
  }
  let total = items.reduce((sum, item) => sum + item.text.length, 0)
  while (items.length > 1 && total > CONFIG.maxEvidenceChars) {
    total -= (items.pop() as EvidenceItem).text.length
  }
  return items
}

// A canned answer for local work. It calls nothing. Each sentence is the opening of an evidence item.
function mockSentences(items: EvidenceItem[]): string[] {
  return items.slice(0, 4).map((item) => {
    const first = item.text.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]$/, '')
    return `${first} [${item.id}]. `
  })
}

export async function handleAsk(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const started = Date.now()
  const log = deps.log ?? ((line: string) => console.log(line))
  // One line per request: time, model, status, duration. Never the question, never a header.
  const note = (model: string, status: string) => log(`${new Date().toISOString()} ask model=${model} status=${status} ms=${Date.now() - started}`)

  if (request.method !== 'POST') {
    note('none', '405')
    return json(405, 'method_not_allowed', 'Use POST.')
  }
  if (!fromOwnSite(request)) {
    note('none', '403')
    return json(403, 'origin_not_allowed', 'This endpoint only answers its own site.')
  }
  const limiter = deps.limiter === undefined ? sharedLimiter : deps.limiter
  if (limiter) {
    const rate = limiter(clientKey(request))
    if (!rate.ok) {
      note('none', '429')
      return json(429, 'rate_limited', RATE_MESSAGE, { 'retry-after': String(Math.ceil(rate.retryAfterMs / 1000)) })
    }
  }
  const text = await request.text()
  const checked = validateBody(text)
  if (!checked.ok) {
    note('none', String(checked.status))
    return json(checked.status, checked.code, checked.message)
  }
  // Off-topic questions and attempts to change the rules are refused here, before any model call.
  const topic = screenQuestion(checked.value.question, topicVocab(deps.search))
  if (!topic.ok) {
    note('none', `422_${topic.reason}`)
    return json(422, 'off_topic', `${REFUSAL} ${TOPIC_HINT}`)
  }
  const bundle = deps.bundle ?? loadBundle()
  const items = pickEvidence(checked.value.evidenceIds, bundle)
  if (items.length === 0) {
    note('none', '400')
    return json(400, 'no_evidence', 'None of the evidence ids is in the bundle.')
  }
  const mock = env.MOCK_MODELS === '1'
  const key = env.OPENROUTER_API_KEY
  if (!mock && !key) {
    note('none', '503')
    return json(503, 'no_model', 'No live model is configured.')
  }
  const messages = buildMessages(checked.value, items)
  const evidenceIds = ['S', ...items.map((item) => item.id)]
  const fetchImpl = deps.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init))

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (bytes: Uint8Array) => {
        try {
          controller.enqueue(bytes)
        } catch {
          // The browser went away. Nothing more to send.
        }
      }
      send(sseComment('accepted'))
      const emit = {
        meta: (model: string) => send(sseEvent('meta', { model, label: CONFIG.labels[model] ?? `${model} through OpenRouter`, bundleId: bundle.bundleId, evidenceIds })),
        delta: (piece: string) => send(sseEvent('delta', { text: piece })),
      }
      try {
        if (mock) {
          emit.meta('mock/local')
          for (const sentence of mockSentences(items)) {
            for (const word of sentence.match(/\S+\s*/g) ?? []) {
              await new Promise((resolve) => setTimeout(resolve, 25))
              emit.delta(word)
            }
          }
          send(sseEvent('done', { finish: 'stop', ms: Date.now() - started }))
          note('mock/local', 'done')
        } else {
          const result = await runChain({ messages, key: key as string, fetchImpl, emit, useBackupOnly: checked.value.use === 'backup', timers: deps.timers })
          if ('failed' in result) {
            send(sseEvent('error', { code: result.code }))
            note('none', `error_${result.code}`)
          } else {
            send(sseEvent('done', { finish: result.finish, ms: Date.now() - started }))
            note(result.model, 'done')
          }
        }
      } catch {
        send(sseEvent('error', { code: 'server_error' }))
        note('none', 'error_server')
      }
      try {
        controller.close()
      } catch {
        // Already closed.
      }
    },
  })
  // The page and the function share one origin, so no Access-Control headers are sent.
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no' },
  })
}

// Calls no model and holds no secret. The browser shows the Live answer panel only when configured is true.
export async function handleHealth(env: Env, deps: Deps = {}): Promise<Response> {
  let bundleId = ''
  try {
    bundleId = (deps.bundle ?? loadBundle()).bundleId
  } catch {
    bundleId = ''
  }
  const mock = env.MOCK_MODELS === '1'
  return new Response(
    JSON.stringify({
      ok: true,
      bundleId,
      configured: mock || Boolean(env.OPENROUTER_API_KEY),
      models: mock ? ['mock/local'] : [CONFIG.modelPrimary, CONFIG.modelBackup],
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  )
}
