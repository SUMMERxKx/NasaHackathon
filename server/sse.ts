// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Reads OpenRouter's stream and writes EMBER's events.
// The parser reads only the fields it knows and ignores the rest.

export type UpstreamEvent =
  | { type: 'text'; text: string; model: string | null }
  | { type: 'finish'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

// Yields one event per meaningful chunk. These are not text and are skipped: comment lines such as
// ": OPENROUTER PROCESSING", chunks whose content is empty or null, thinking text in delta.reasoning,
// and the closing chunk that carries only the usage figures.
export async function* readUpstream(body: ReadableStream<Uint8Array>): AsyncGenerator<UpstreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '') continue
        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }
        let chunk: Record<string, unknown>
        try {
          chunk = JSON.parse(data)
        } catch {
          continue
        }
        // A 200 is not a success. An error can be the first and only event in the stream.
        if (chunk.error) {
          const error = chunk.error as { message?: unknown }
          yield { type: 'error', message: typeof error.message === 'string' ? error.message : 'upstream error' }
          return
        }
        const choices = Array.isArray(chunk.choices) ? chunk.choices : []
        const choice = choices[0] as { delta?: { content?: unknown }; finish_reason?: unknown } | undefined
        if (!choice) continue
        const content = choice.delta?.content
        if (typeof content === 'string' && content.length > 0) {
          yield { type: 'text', text: content, model: typeof chunk.model === 'string' ? chunk.model : null }
        }
        if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
          yield { type: 'finish', reason: choice.finish_reason }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

const encoder = new TextEncoder()

export const sseComment = (text: string): Uint8Array => encoder.encode(`: ${text}\n\n`)

export const sseEvent = (event: 'meta' | 'delta' | 'done' | 'error', data: Record<string, unknown>): Uint8Array =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
