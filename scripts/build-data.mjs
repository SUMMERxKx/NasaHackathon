// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Normalizes the raw PSI files and writes every generated data file. No network.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildAll } from './lib/pipeline.mjs'
import { ROOT } from './lib/util.mjs'

const out = join(ROOT, 'public/data')
mkdirSync(out, { recursive: true })
const built = buildAll(ROOT)
for (const [name, text] of Object.entries(built.files)) {
  writeFileSync(join(out, name), text)
  console.log(`${name.padEnd(20)} ${String(text.length).padStart(9)} bytes`)
}
const c = built.snapshot.counts
console.log(`${c.investigations} investigations, ${c.tables} tables, ${c.rows} rows, ${c.tests} tests. Build ${built.snapshot.buildId}.`)
console.log(`${built.insightsFile.insights.length} insight cards, all verified. ${Object.keys(built.evidence.items).length} evidence items. ${built.search.docs.length} search documents.`)
