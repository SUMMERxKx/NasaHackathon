// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The model chain: the first choice, then the backup, with EMBER's own timers.
// OpenRouter's own fallback fires on errors and not on slowness, so EMBER cancels a slow call itself.
import { CONFIG } from './config.ts'
import { readUpstream } from './sse.ts'

type Message = { role: 'system' | 'user'; content: string }
type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export type ChainResult = { finish: string; model: string } | { failed: true; code: string; sentText: boolean }

type Emit = {
  meta: (model: string) => void
  delta: (text: string) => void
}

type Attempt = { status: 'ok'; finish: string; model: string } | { status: 'failed'; reason: string; sentText: boolean }

async function attempt(
  model: string,
  messages: Message[],
  key: string,
  fetchImpl: FetchLike,
  emit: Emit,
  firstTextMs: number,
  totalMs: number,
): Promise<Attempt> {
  const controller = new AbortController()
  let sentText = false
  let timedOut = ''
  const firstTimer = setTimeout(() => {
    timedOut = 'no_first_text'
    controller.abort()
  }, firstTextMs)
  const totalTimer = setTimeout(() => {
    timedOut = 'total_time'
    controller.abort()
  }, totalMs)
  try {
    const response = await fetchImpl(CONFIG.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      // No temperature is sent. No app headers are sent.
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: CONFIG.maxTokens,
        reasoning: { effort: CONFIG.reasoningEffort },
      }),
    })
    if (response.status !== 200 || !response.body) return { status: 'failed', reason: `status_${response.status}`, sentText }
    let finish = ''
    let answering = model
    for await (const event of readUpstream(response.body)) {
      if (event.type === 'error') return { status: 'failed', reason: 'upstream_error', sentText }
      if (event.type === 'text') {
        if (!sentText) {
          // First text means visible text. The meta event names the model that really answers.
          clearTimeout(firstTimer)
          answering = event.model || model
          emit.meta(answering)
          sentText = true
        }
        emit.delta(event.text)
      }
      if (event.type === 'finish') finish = event.reason
      if (event.type === 'done') break
    }
    // A finish with no text is a failure, whatever the finish reason says.
    if (!sentText) return { status: 'failed', reason: finish ? `empty_${finish}` : 'empty', sentText }
    if (finish === 'error') return { status: 'failed', reason: 'finish_error', sentText }
    return { status: 'ok', finish: finish || 'stop', model: answering }
  } catch {
    return { status: 'failed', reason: timedOut || 'network', sentText }
  } finally {
    clearTimeout(firstTimer)
    clearTimeout(totalTimer)
    controller.abort()
  }
}

export async function runChain(options: {
  messages: Message[]
  key: string
  fetchImpl: FetchLike
  emit: Emit
  useBackupOnly?: boolean
  timers?: { firstTextMs: { primary: number; backup: number }; totalMs: { primary: number; backup: number } }
}): Promise<ChainResult> {
  const timers = options.timers ?? { firstTextMs: CONFIG.firstTextMs, totalMs: CONFIG.totalMs }
  if (!options.useBackupOnly) {
    const first = await attempt(CONFIG.modelPrimary, options.messages, options.key, options.fetchImpl, options.emit, timers.firstTextMs.primary, timers.totalMs.primary)
    if (first.status === 'ok') return { finish: first.finish, model: first.model }
    // No splice. Once any text has reached the browser, a failure ends the stream.
    if (first.sentText) return { failed: true, code: 'stream_broke', sentText: true }
  }
  const second = await attempt(CONFIG.modelBackup, options.messages, options.key, options.fetchImpl, options.emit, timers.firstTextMs.backup, timers.totalMs.backup)
  if (second.status === 'ok') return { finish: second.finish, model: second.model }
  return { failed: true, code: second.sentText ? 'stream_broke' : 'no_answer', sentText: second.sentText }
}
