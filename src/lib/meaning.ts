// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Search by meaning. Document vectors come prebuilt in the search index. Comparing one question
// against a few hundred vectors is a plain loop.
import type { SearchDoc, SearchIndexFile } from '../types.ts'

export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const EMBED_DTYPE = 'q8'
export const EMBED_DIM = 384
export const MAX_CHUNK_WORDS = 200

const words = (text: string, limit = MAX_CHUNK_WORDS): string => text.replace(/\s+/g, ' ').trim().split(' ').slice(0, limit).join(' ')

// The embedding model reads at most 256 word pieces, so longer text would be cut off silently.
// An investigation is split into at most three chunks of up to 200 words each.
export function chunksFor(doc: SearchDoc, extra?: { objective: string; hypothesis: string; approach: string; impacts: string }): string[] {
  if (doc.kind === 'investigation' && extra) {
    return [
      words(`${doc.acronym ?? ''}. ${doc.title}. ${doc.summary ?? ''}`),
      words(`${extra.objective} ${extra.hypothesis}`),
      words(`${extra.approach} ${extra.impacts}`),
    ].filter((chunk) => chunk.length > 20)
  }
  return [words(`${doc.title}. ${doc.keywords ?? ''} ${doc.body}`)]
}

// Vectors are normalized, stored as signed bytes and encoded as base64.
export function encodeVectors(vectors: Float32Array[]): string {
  const bytes = new Int8Array(vectors.length * EMBED_DIM)
  vectors.forEach((vector, row) => {
    for (let i = 0; i < EMBED_DIM; i += 1) bytes[row * EMBED_DIM + i] = Math.max(-127, Math.min(127, Math.round(vector[i] * 127)))
  })
  let binary = ''
  const view = new Uint8Array(bytes.buffer)
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i])
  return btoa(binary)
}

export function decodeVectors(base64: string): Int8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Int8Array(bytes.buffer)
}

// The best similarity per document. A document's score is the best score among its chunks.
export function scoreMeaning(query: ArrayLike<number>, embedding: NonNullable<SearchIndexFile['embedding']>, vectors: Int8Array): Map<string, number> {
  const out = new Map<string, number>()
  let norm = 0
  for (let i = 0; i < EMBED_DIM; i += 1) norm += query[i] * query[i]
  norm = Math.sqrt(norm) || 1
  embedding.chunkDocIds.forEach((docId, row) => {
    let dot = 0
    let length = 0
    const base = row * EMBED_DIM
    for (let i = 0; i < EMBED_DIM; i += 1) {
      const v = vectors[base + i]
      dot += query[i] * v
      length += v * v
    }
    const score = dot / (norm * (Math.sqrt(length) || 1))
    if (score > (out.get(docId) ?? -1)) out.set(docId, score)
  })
  return out
}
