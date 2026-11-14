// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Helpers for the two manual scripts that talk to the deployed site. Never used in a deploy.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildEngine, retrieve } from '../../src/lib/retrieve.ts'
import { fromHabitat, scenarioLine } from '../../src/state/scenario.ts'
import { ROOT } from './util.mjs'

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

export function loadLocal() {
  const snapshot = read('public/data/snapshot.json')
  const evidence = read('public/data/evidence.json')
  const search = read('public/data/search-index.json')
  const evalSet = read('data/manual/eval-questions.json')
  return { snapshot, evidence, search, evalSet, engine: buildEngine(search) }
}

export function siteArg() {
  const index = process.argv.indexOf('--site')
  const site = index > 0 ? process.argv[index + 1] : ''
  if (!site || !/^https?:\/\//.test(site)) {
    console.error('Give the production address, for example: --site https://your-project.vercel.app')
    process.exit(1)
  }
  return site.replace(/\/$/, '')
}

// The same retrieval code as the app, in keyword mode so the result is repeatable.
export function prepare(local, question, habitatId) {
  const habitat = local.snapshot.habitats.find((h) => h.id === (habitatId || 'iss'))
  const scenario = fromHabitat(habitat)
  const result = retrieve(question, local.engine, { scenario, investigations: local.snapshot.investigations, tests: local.snapshot.tests, habitats: local.snapshot.habitats })
  const ids = result.pack.map((p) => p.evidenceId).slice(0, 7)
  return { scenario, result, ids, pack: ids.map((id) => local.evidence.items[id]).filter(Boolean), line: scenarioLine(scenario, local.snapshot.habitats) }
}

export async function askSite(site, body) {
  const started = Date.now()
  let firstMs = null
  let text = ''
  let meta = null
  let error = null
  try {
    const response = await fetch(`${site}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })
    if (!response.ok) return { ok: false, error: `status ${response.status}`, text, meta, firstMs, ms: Date.now() - started }
    const raw = await response.text()
    for (const block of raw.split('\n\n')) {
      const event = block.match(/^event: (.+)$/m)?.[1]
      const data = block.match(/^data: (.+)$/m)?.[1]
      if (!event || !data) continue
      const parsed = JSON.parse(data)
      if (event === 'meta') meta = parsed
      if (event === 'delta') text += parsed.text
      if (event === 'done') firstMs = parsed.ms
      if (event === 'error') error = parsed.code
    }
  } catch (e) {
    error = e.message
  }
  return { ok: !error && text.trim() !== '', error, text, meta, firstMs, ms: Date.now() - started }
}
