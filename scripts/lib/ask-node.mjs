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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// The firewall allows 8 requests a minute from one address, so calls are spaced out.
const GAP_MS = 8000
let lastCallAt = 0

async function post(site, body) {
  for (let attempt = 1; ; attempt += 1) {
    const wait = lastCallAt + GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastCallAt = Date.now()
    const response = await fetch(`${site}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })
    if (response.status !== 429 || attempt >= 3) return response
    await response.arrayBuffer()
    await sleep(60000)
  }
}

// Posts one question and reads the stream as it arrives. firstMs is the time from the request
// to the first text, measured on this machine. ms is the time to the complete answer.
export async function askSite(site, body) {
  let started = Date.now()
  let firstMs = null
  let text = ''
  let meta = null
  let error = null
  const take = (block) => {
    const event = block.match(/^event: (.+)$/m)?.[1]
    const data = block.match(/^data: (.+)$/m)?.[1]
    if (!event || !data) return
    const parsed = JSON.parse(data)
    if (event === 'meta') meta = parsed
    if (event === 'delta') {
      if (firstMs === null) firstMs = Date.now() - started
      text += parsed.text
    }
    if (event === 'error') error = parsed.code
  }
  try {
    const response = await post(site, body)
    started = lastCallAt
    if (!response.ok) return { ok: false, error: `status ${response.status}`, text, meta, firstMs, ms: Date.now() - started }
    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''
      for (const block of blocks) take(block)
    }
    if (buffer.trim() !== '') take(buffer)
  } catch (e) {
    error = e.message
  }
  return { ok: !error && text.trim() !== '', error, text, meta, firstMs, ms: Date.now() - started }
}
