// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Steps 2 to 6 of the pipeline as one function. The same inputs always give byte-identical files.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSnapshot, buildTestsCsv } from './normalize.mjs'
import { buildInsightsFile } from './insights.mjs'
import { verifyInsights } from './verify.mjs'
import { buildEvidence, buildSearchIndex } from './evidence.mjs'
import { toJson } from './util.mjs'

export function buildAll(root) {
  const snapshot = buildSnapshot(root)
  const insightsFile = buildInsightsFile(snapshot)
  insightsFile.insights = verifyInsights(snapshot, insightsFile.insights, root)
  const evidence = buildEvidence(snapshot, insightsFile.insights)
  const search = buildSearchIndex(snapshot, insightsFile.insights, evidence)
  // The embedding vectors are built on the build machine and carried over as they are.
  const committed = join(root, 'public/data/search-index.json')
  if (existsSync(committed)) {
    try {
      const old = JSON.parse(readFileSync(committed, 'utf8'))
      if (old.embedding && old.buildId === search.buildId) search.embedding = old.embedding
    } catch {
      // A broken old file is replaced.
    }
  }
  return {
    snapshot,
    insightsFile,
    evidence,
    search,
    files: {
      'snapshot.json': toJson(snapshot),
      'insights.json': toJson(insightsFile),
      'evidence.json': toJson(evidence),
      'search-index.json': toJson(search),
      'tests.csv': buildTestsCsv(snapshot),
    },
  }
}
