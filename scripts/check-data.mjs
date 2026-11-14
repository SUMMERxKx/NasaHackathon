// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Rebuilds the generated files in memory and compares them byte for byte with the committed ones.
// It does not rely on git. It fails when a file was edited by hand or not rebuilt.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildAll } from './lib/pipeline.mjs'
import { ROOT } from './lib/util.mjs'

const built = buildAll(ROOT)
let failed = false
for (const [name, text] of Object.entries(built.files)) {
  const path = join(ROOT, 'public/data', name)
  if (!existsSync(path)) {
    console.error(`Missing: public/data/${name}. Run npm run build:data.`)
    failed = true
    continue
  }
  if (readFileSync(path, 'utf8') !== text) {
    console.error(`Out of date: public/data/${name}. Run npm run build:data and commit the result.`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log(`check:data passed. ${Object.keys(built.files).length} generated files match their inputs.`)
