// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Embeds every search document with the model files in public/models/embed and stores the vectors
// in search-index.json. It runs on the build machine and never in a deploy. No network.
// The same model file and the same precision, q8, are used here and in the browser.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env, pipeline } from '@huggingface/transformers'
import { EMBED_DIM, EMBED_DTYPE, EMBED_MODEL, chunksFor, encodeVectors } from '../src/lib/meaning.ts'
import { ROOT, toJson } from './lib/util.mjs'

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = join(ROOT, 'public/models/embed/')

const path = join(ROOT, 'public/data/search-index.json')
const index = JSON.parse(readFileSync(path, 'utf8'))
const snapshot = JSON.parse(readFileSync(join(ROOT, 'public/data/snapshot.json'), 'utf8'))
const byAccession = Object.fromEntries(snapshot.investigations.map((i) => [i.accession, i]))
const extractor = await pipeline('feature-extraction', EMBED_MODEL, { dtype: EMBED_DTYPE })

const chunkDocIds = []
const vectors = []
for (const doc of index.docs) {
  const inv = doc.kind === 'investigation' ? byAccession[doc.evidenceId] : null
  const extra = inv ? { objective: inv.objective, hypothesis: inv.hypothesis, approach: inv.approach, impacts: inv.researchImpacts } : undefined
  for (const chunk of chunksFor(doc, extra)) {
    const output = await extractor(chunk, { pooling: 'mean', normalize: true })
    vectors.push(Float32Array.from(output.data))
    chunkDocIds.push(doc.id)
  }
}
index.embedding = { model: EMBED_MODEL, dtype: EMBED_DTYPE, dim: EMBED_DIM, encoding: 'int8-base64', chunkDocIds, vectors: encodeVectors(vectors) }
writeFileSync(path, toJson(index))
console.log(`Embedded ${vectors.length} chunks of ${index.docs.length} documents. Vectors are ${Math.round((vectors.length * EMBED_DIM) / 1024)} KB before encoding.`)
