// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The browser's side of the live answer: one POST to /api/ask on the site's own address,
// read as a stream of meta, delta, done and error events.
import type { AskRequest } from '../types.ts'

export const FIRST_WORD_MS = 12000
export const TOTAL_MS = 30000

export type LiveFailure = 'timeout' | 'network' | 'rate_limited' | 'off_topic' | 'error'
export type LiveMeta = { model: string; label: string; bundleId: string; evidenceIds: string[] }
export type LiveResult = { ok: true; text: string; meta: LiveMeta } | { ok: false; reason: LiveFailure }

export type Health = { ok: boolean; bundleId: string; configured: boolean; models: string[] }

export async function fetchHealth(signal?: AbortSignal): Promise<Health | null> {
  try {
    const response = await fetch('/api/health', { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return null
    const body = (await response.json()) as Health
    return typeof body.configured === 'boolean' ? body : null
  } catch {
    return null
  }
}

export function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith(':') || line.trim() === '') continue
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trim())
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null
}

// Stops the request if no first word arrives within 12 seconds or the answer is not complete in 30.
export async function askLive(
  request: AskRequest,
  handlers: { onMeta?: (meta: LiveMeta) => void; onDelta?: (text: string) => void },
  outer?: AbortSignal,
): Promise<LiveResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  outer?.addEventListener('abort', abort)
  let timedOut = false
  const firstTimer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, FIRST_WORD_MS)
  const totalTimer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TOTAL_MS)
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (response.status === 429) return { ok: false, reason: 'rate_limited' }
    // The server's topic screen refused the question before any model call.
    if (response.status === 422) return { ok: false, reason: 'off_topic' }
    if (!response.ok || !response.body || !(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
      return { ok: false, reason: 'error' }
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    let meta: LiveMeta | null = null
    let finished = false
    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let cut = buffer.indexOf('\n\n')
      while (cut >= 0) {
        const parsed = parseSseBlock(buffer.slice(0, cut))
        buffer = buffer.slice(cut + 2)
        cut = buffer.indexOf('\n\n')
        if (!parsed) continue
        let data: Record<string, unknown>
        try {
          data = JSON.parse(parsed.data)
        } catch {
          continue
        }
        if (parsed.event === 'meta') {
          meta = data as unknown as LiveMeta
          handlers.onMeta?.(meta)
        } else if (parsed.event === 'delta' && typeof data.text === 'string') {
          if (text === '') clearTimeout(firstTimer)
          text += data.text
          handlers.onDelta?.(data.text)
        } else if (parsed.event === 'done') {
          finished = true
        } else if (parsed.event === 'error') {
          // A stream that broke is discarded, whatever text arrived before it.
          return { ok: false, reason: 'error' }
        }
      }
    }
    if (!finished || !meta || text.trim() === '') return { ok: false, reason: 'error' }
    return { ok: true, text, meta }
  } catch {
    return { ok: false, reason: timedOut ? 'timeout' : 'network' }
  } finally {
    clearTimeout(firstTimer)
    clearTimeout(totalTimer)
    outer?.removeEventListener('abort', abort)
  }
}

// The session cache key: the question in lower case with spaces collapsed, the habitat and the sorted ids.
export function cacheKey(request: AskRequest): string {
  const q = request.question.toLowerCase().replace(/\s+/g, ' ').trim()
  const s = request.scenario
  return `${q}|${s.presetId ?? ''}|${s.o2}|${s.pressurePsi}|${s.gravity}|${[...request.evidenceIds].sort().join(',')}`
}
