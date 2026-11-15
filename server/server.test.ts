// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The server function with stubbed models. No test calls a live model.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { EvidenceBundle } from '../src/types.ts'
import { CONFIG } from './config.ts'
import { handleAsk, handleHealth, loadBundle, pickEvidence } from './handler.ts'
import { SYSTEM_MESSAGE, buildMessages, habitatLine } from './prompt.ts'

const bundle = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public/data/evidence.json'), 'utf8')) as EvidenceBundle
const scenario = { presetId: 'exploration', o2: 0.34, pressurePsi: 8.2, gravity: 0.166 }
const QUESTION = 'What is missing for the Moon, exactly?'
const timers = { firstTextMs: { primary: 60, backup: 60 }, totalMs: { primary: 400, backup: 400 } }

type Call = { model: string; body: string }

const chunk = (data: unknown): string => `data: ${JSON.stringify(data)}\n\n`
const textChunk = (model: string, content: string) => chunk({ model, choices: [{ delta: { content } }] })
const finishChunk = (reason: string) => chunk({ choices: [{ delta: {}, finish_reason: reason }] })

function streamOf(parts: { text: string; delayMs?: number }[], signal?: AbortSignal | null, failAfter = false): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const onAbort = () => {
        try {
          controller.error(new Error('aborted'))
        } catch {
          // Already closed.
        }
      }
      signal?.addEventListener('abort', onAbort)
      for (const part of parts) {
        if (part.delayMs) await new Promise((resolve) => setTimeout(resolve, part.delayMs))
        if (signal?.aborted) return
        controller.enqueue(encoder.encode(part.text))
      }
      if (failAfter) {
        // Give the reader time to take the text before the stream breaks.
        await new Promise((resolve) => setTimeout(resolve, 20))
        controller.error(new Error('broke'))
      } else controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function stub(byModel: Record<string, (signal: AbortSignal | null | undefined) => Response | Promise<Response>>) {
  const calls: Call[] = []
  const fetchImpl = async (_url: string, init: RequestInit) => {
    const body = String(init.body)
    const model = JSON.parse(body).model as string
    calls.push({ model, body })
    return byModel[model](init.signal)
  }
  return { calls, fetchImpl }
}

const goodPrimary = () => streamOf([{ text: ': OPENROUTER PROCESSING\n\n' }, { text: textChunk(CONFIG.modelPrimary, 'Solid tests stop at 22.2% oxygen [I1]. ') }, { text: textChunk(CONFIG.modelPrimary, 'No partial-gravity tests exist [I3].') }, { text: finishChunk('stop') }, { text: chunk({ choices: [], usage: { total_tokens: 9 } }) }, { text: 'data: [DONE]\n\n' }])
const goodBackup = () => streamOf([{ text: textChunk(CONFIG.modelBackup, 'Backup answer [I1].') }, { text: finishChunk('stop') }, { text: 'data: [DONE]\n\n' }])

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://ember.example/api/ask', { method: 'POST', headers: { 'content-type': 'application/json', host: 'ember.example', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

async function events(response: Response): Promise<{ event: string; data: Record<string, unknown> }[]> {
  const text = await response.text()
  const out: { event: string; data: Record<string, unknown> }[] = []
  for (const block of text.split('\n\n')) {
    const event = block.match(/^event: (.+)$/m)?.[1]
    const data = block.match(/^data: (.+)$/m)?.[1]
    if (event && data) out.push({ event, data: JSON.parse(data) })
  }
  return out
}

const env = { OPENROUTER_API_KEY: 'test-key-not-real' }
const base = { question: QUESTION, scenario, evidenceIds: ['I1', 'I3'] }
const quiet = { bundle, log: () => {}, timers }

describe('request checks', () => {
  it('rejects any method other than POST', async () => {
    const response = await handleAsk(new Request('https://ember.example/api/ask', { method: 'GET' }), env, quiet)
    expect(response.status).toBe(405)
    expect((await response.json()).error.code).toBe('method_not_allowed')
  })
  it('rejects a foreign origin and accepts its own', async () => {
    const foreign = await handleAsk(post(base, { origin: 'https://evil.example' }), env, { ...quiet, fetchImpl: stub({}).fetchImpl })
    expect(foreign.status).toBe(403)
    expect((await foreign.json()).error.code).toBe('origin_not_allowed')
    const own = await handleAsk(post(base, { origin: 'https://ember.example' }), env, { ...quiet, fetchImpl: stub({ [CONFIG.modelPrimary]: goodPrimary }).fetchImpl })
    expect(own.status).toBe(200)
    expect(own.headers.get('access-control-allow-origin')).toBeNull()
  })
  it('rejects a question over 300 characters, a missing question and a body that is not JSON', async () => {
    const long = await handleAsk(post({ ...base, question: 'x'.repeat(301) }), env, quiet)
    expect(long.status).toBe(400)
    expect((await long.json()).error.code).toBe('bad_request')
    expect((await handleAsk(post({ ...base, question: '   ' }), env, quiet)).status).toBe(400)
    expect((await handleAsk(post('not json'), env, quiet)).status).toBe(400)
    expect((await handleAsk(post({ ...base, evidenceIds: Array.from({ length: 9 }, (_, i) => `I${i + 1}`) }), env, quiet)).status).toBe(400)
    expect((await handleAsk(post({ ...base, scenario: { ...scenario, o2: 9 } }), env, quiet)).status).toBe(400)
  })
  it('rejects a body over 4,000 bytes', async () => {
    const response = await handleAsk(post({ ...base, padding: 'x'.repeat(5000) }), env, quiet)
    expect(response.status).toBe(413)
    expect((await response.json()).error.code).toBe('too_large')
  })
  it('drops unknown evidence ids and answers 400 with none left', async () => {
    expect(pickEvidence(['I1', 'NOPE', 'I1', 'I999', 'PSI-69'], bundle).map((i) => i.id)).toEqual(['I1', 'PSI-69'])
    const response = await handleAsk(post({ ...base, evidenceIds: ['NOPE', 'I999'] }), env, quiet)
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('no_evidence')
  })
  it('answers 503 when no key is set', async () => {
    const response = await handleAsk(post(base), {}, quiet)
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('no_model')
  })
})

describe('what the model sees', () => {
  it('never passes browser-supplied evidence text to a model', async () => {
    const { calls, fetchImpl } = stub({ [CONFIG.modelPrimary]: goodPrimary })
    const sneaky = { ...base, evidenceIds: ['I1', 'NOPE'], evidence: [{ id: 'I1', text: 'INJECTED-TEXT-FROM-BROWSER' }], evidenceText: 'INJECTED-TEXT-FROM-BROWSER', scenario: { ...scenario, name: 'INJECTED-NAME' } }
    const response = await handleAsk(post(sneaky), env, { ...quiet, fetchImpl })
    await response.text()
    expect(calls.length).toBe(1)
    expect(calls[0].body).not.toContain('INJECTED')
    expect(calls[0].body).toContain(JSON.stringify(bundle.items.I1.text).slice(1, 60))
    const sent = JSON.parse(calls[0].body)
    expect(sent.stream).toBe(true)
    expect(sent.max_tokens).toBe(600)
    expect(sent.reasoning).toEqual({ effort: 'none' })
    expect(sent.temperature).toBeUndefined()
  })
  it('builds a prompt with every sent id and only the question from the browser', () => {
    const items = pickEvidence(['I1', 'I3', 'PSI-25'], bundle)
    const messages = buildMessages({ question: QUESTION, scenario: { ...scenario, gravity: 0.166 }, evidenceIds: [] }, items)
    expect(messages[0].content).toBe(SYSTEM_MESSAGE)
    for (const item of items) expect(messages[1].content).toContain(`[${item.id}] (${item.kind})`)
    expect(messages[1].content).toContain('HABITAT [S]: Exploration atmosphere. 34% oxygen, 8.2 psi, Moon gravity 0.166 g.')
    expect(messages[1].content).toContain(`QUESTION: """${QUESTION}"""`)
    const cut = buildMessages({ question: 'q'.repeat(400), scenario: { ...scenario, gravity: 0.166 }, evidenceIds: [] }, items)
    expect(cut[1].content.match(/q+/g)?.at(-1)?.length).toBe(300)
    expect(habitatLine({ presetId: null, o2: 0.5, pressurePsi: 5, gravity: 0 })).toBe('Custom habitat. 50% oxygen, 5 psi, microgravity.')
  })
  it('reads the same evidence file the site serves', () => {
    expect(loadBundle().bundleId).toBe(bundle.bundleId)
  })
})

describe('the model chain', () => {
  it('streams the first choice and names the model that produced the text', async () => {
    const { calls, fetchImpl } = stub({ [CONFIG.modelPrimary]: goodPrimary, [CONFIG.modelBackup]: goodBackup })
    const response = await handleAsk(post(base), env, { ...quiet, fetchImpl })
    const raw = await response.clone().text()
    expect(raw.startsWith(': accepted')).toBe(true)
    const list = await events(response)
    expect(list[0].event).toBe('meta')
    expect(list[0].data.model).toBe(CONFIG.modelPrimary)
    expect(list[0].data.bundleId).toBe(bundle.bundleId)
    expect(list[0].data.evidenceIds).toEqual(['S', 'I1', 'I3'])
    expect(list.filter((e) => e.event === 'delta').map((e) => e.data.text).join('')).toBe('Solid tests stop at 22.2% oxygen [I1]. No partial-gravity tests exist [I3].')
    expect(list.at(-1)?.event).toBe('done')
    expect(calls.map((c) => c.model)).toEqual([CONFIG.modelPrimary])
  })
  it('answers from the backup when the first choice returns an error status', async () => {
    const { calls, fetchImpl } = stub({ [CONFIG.modelPrimary]: () => new Response('{"error":{"message":"no credit"}}', { status: 402 }), [CONFIG.modelBackup]: goodBackup })
    const list = await events(await handleAsk(post(base), env, { ...quiet, fetchImpl }))
    expect(list[0].data.model).toBe(CONFIG.modelBackup)
    expect(list.at(-1)?.event).toBe('done')
    expect(calls.map((c) => c.model)).toEqual([CONFIG.modelPrimary, CONFIG.modelBackup])
  })
  it('answers from the backup when the first choice sends only comments and thinking text', async () => {
    const slow = (signal: AbortSignal | null | undefined) =>
      streamOf([{ text: ': OPENROUTER PROCESSING\n\n' }, { text: chunk({ choices: [{ delta: { content: '', reasoning: 'thinking hard' } }] }) }, { text: chunk({ choices: [{ delta: { content: null } }] }), delayMs: 30 }, { text: textChunk(CONFIG.modelPrimary, 'too late'), delayMs: 300 }], signal)
    const { fetchImpl } = stub({ [CONFIG.modelPrimary]: slow, [CONFIG.modelBackup]: goodBackup })
    const list = await events(await handleAsk(post(base), env, { ...quiet, fetchImpl }))
    expect(list[0].data.model).toBe(CONFIG.modelBackup)
    expect(list.some((e) => e.data.text === 'too late')).toBe(false)
  })
  it('answers from the backup when the first choice ends with length and no text', async () => {
    const empty = () => streamOf([{ text: finishChunk('length') }, { text: 'data: [DONE]\n\n' }])
    const { fetchImpl } = stub({ [CONFIG.modelPrimary]: empty, [CONFIG.modelBackup]: goodBackup })
    const list = await events(await handleAsk(post(base), env, { ...quiet, fetchImpl }))
    expect(list[0].data.model).toBe(CONFIG.modelBackup)
  })
  it('answers from the backup when the only chunk carries an error object', async () => {
    const errored = () => streamOf([{ text: chunk({ error: { code: 502, message: 'provider down' } }) }])
    const { fetchImpl } = stub({ [CONFIG.modelPrimary]: errored, [CONFIG.modelBackup]: goodBackup })
    const list = await events(await handleAsk(post(base), env, { ...quiet, fetchImpl }))
    expect(list[0].data.model).toBe(CONFIG.modelBackup)
    expect(list.at(-1)?.event).toBe('done')
  })
  it('ends with an error and no backup text when a stream fails after sending text', async () => {
    const broken = () => streamOf([{ text: textChunk(CONFIG.modelPrimary, 'Half an answer') }], null, true)
    const { calls, fetchImpl } = stub({ [CONFIG.modelPrimary]: broken, [CONFIG.modelBackup]: goodBackup })
    const list = await events(await handleAsk(post(base), env, { ...quiet, fetchImpl }))
    expect(list.at(-1)?.event).toBe('error')
    expect(list.some((e) => String(e.data.text ?? '').includes('Backup'))).toBe(false)
    expect(calls.map((c) => c.model)).toEqual([CONFIG.modelPrimary])
  })
  it('does not throw on an empty choices list and does not send the usage chunk as text', async () => {
    const odd = () => streamOf([{ text: chunk({ choices: [] }) }, { text: 'data: not json\n\n' }, { text: textChunk(CONFIG.modelPrimary, 'Fine [I1].') }, { text: finishChunk('stop') }, { text: chunk({ choices: [], usage: { prompt_tokens: 2000, completion_tokens: 12 } }) }, { text: 'data: [DONE]\n\n' }])
    const { fetchImpl } = stub({ [CONFIG.modelPrimary]: odd })
    const list = await events(await handleAsk(post(base), env, { ...quiet, fetchImpl }))
    expect(list.filter((e) => e.event === 'delta').length).toBe(1)
    expect(list.at(-1)?.event).toBe('done')
  })
  it('sends an error event when both models fail', async () => {
    const down = () => new Response('', { status: 500 })
    const { fetchImpl } = stub({ [CONFIG.modelPrimary]: down, [CONFIG.modelBackup]: down })
    const list = await events(await handleAsk(post(base), env, { ...quiet, fetchImpl }))
    expect(list).toEqual([{ event: 'error', data: { code: 'no_answer' } }])
  })
  it('goes straight to the backup when the evaluation asks for it', async () => {
    const { calls, fetchImpl } = stub({ [CONFIG.modelPrimary]: goodPrimary, [CONFIG.modelBackup]: goodBackup })
    const list = await events(await handleAsk(post({ ...base, use: 'backup' }), env, { ...quiet, fetchImpl }))
    expect(calls.map((c) => c.model)).toEqual([CONFIG.modelBackup])
    expect(list[0].data.label).toBe('GPT-6 Luna through OpenRouter')
  })
})

describe('logging, the mock setting and the health check', () => {
  it('never logs the question, the key or a header', async () => {
    const lines: string[] = []
    const { fetchImpl } = stub({ [CONFIG.modelPrimary]: goodPrimary })
    const response = await handleAsk(post(base, { 'x-secret-header': 'header-value-123' }), env, { ...quiet, fetchImpl, log: (line) => lines.push(line) })
    await response.text()
    await handleAsk(post({ ...base, question: 'x'.repeat(301) }), env, { ...quiet, log: (line) => lines.push(line) })
    expect(lines.length).toBe(2)
    for (const line of lines) {
      expect(line).not.toContain('Moon')
      expect(line).not.toContain(env.OPENROUTER_API_KEY)
      expect(line).not.toContain('header-value-123')
      expect(line).toMatch(/ask model=\S+ status=\S+ ms=\d+$/)
    }
  })
  it('streams a canned answer with the mock setting and calls nothing', async () => {
    let called = false
    const list = await events(
      await handleAsk(post(base), { MOCK_MODELS: '1' }, { ...quiet, fetchImpl: async () => {
        called = true
        return new Response('')
      } }),
    )
    expect(called).toBe(false)
    expect(list[0].data.model).toBe('mock/local')
    expect(list.at(-1)?.event).toBe('done')
  })
  it('reports whether a model is configured without holding a secret', async () => {
    const off = await (await handleHealth({}, { bundle })).json()
    expect(off).toEqual({ ok: true, bundleId: bundle.bundleId, configured: false, models: [CONFIG.modelPrimary, CONFIG.modelBackup] })
    const on = await (await handleHealth(env, { bundle })).text()
    expect(JSON.parse(on).configured).toBe(true)
    expect(on).not.toContain(env.OPENROUTER_API_KEY)
  })
})
