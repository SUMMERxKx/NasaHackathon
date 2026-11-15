// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The embedding model for search by meaning. It runs in a Web Worker so typing never freezes.
// The model files and the runtime are served by the site itself. Nothing is fetched from another host.
import { env, pipeline } from '@huggingface/transformers'
import { EMBED_DTYPE, EMBED_MODEL } from '../lib/meaning.ts'

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = '/models/embed/'
// Keep the build the library chose for this browser, and point it at the site's own copy.
const wasm = env.backends.onnx.wasm as { wasmPaths?: unknown } | undefined
if (wasm) {
  const chosen = wasm.wasmPaths as { mjs?: string; wasm?: string } | string | undefined
  const base = (url: string | undefined, fallback: string) => `/ort/${(url ?? fallback).split('/').pop()}`
  wasm.wasmPaths =
    typeof chosen === 'object' && chosen
      ? { mjs: base(chosen.mjs, 'ort-wasm-simd-threaded.asyncify.mjs'), wasm: base(chosen.wasm, 'ort-wasm-simd-threaded.asyncify.wasm') }
      : { mjs: '/ort/ort-wasm-simd-threaded.asyncify.mjs', wasm: '/ort/ort-wasm-simd-threaded.asyncify.wasm' }
}

type Extractor = (text: string, options: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>
let extractor: Promise<Extractor> | null = null
const load = (): Promise<Extractor> => {
  if (!extractor) extractor = pipeline('feature-extraction', EMBED_MODEL, { dtype: EMBED_DTYPE }) as unknown as Promise<Extractor>
  return extractor
}

self.onmessage = async (event: MessageEvent<{ id: number; text?: string }>) => {
  const { id, text } = event.data
  try {
    const run = await load()
    if (text == null) {
      self.postMessage({ id, ready: true })
      return
    }
    const output = await run(text, { pooling: 'mean', normalize: true })
    self.postMessage({ id, vector: Float32Array.from(output.data) })
  } catch (error) {
    self.postMessage({ id, error: String(error) })
  }
}
