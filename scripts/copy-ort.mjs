// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Copies the search model's two runtime builds from node_modules into public/ort before each build,
// so they are served by the site itself and never fetched from a script host. They are not committed.
// Most browsers ask for the first build. Older Safari asks for the second.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib/util.mjs'

const from = join(ROOT, 'node_modules/onnxruntime-web/dist')
const to = join(ROOT, 'public/ort')
const files = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']
if (!existsSync(from)) {
  console.warn('copy-ort: onnxruntime-web is not installed. Search by meaning will fall back to keyword search.')
  process.exit(0)
}
mkdirSync(to, { recursive: true })
let copied = 0
for (const file of files) {
  if (!existsSync(join(from, file))) {
    console.warn(`copy-ort: ${file} is missing from onnxruntime-web.`)
    continue
  }
  copyFileSync(join(from, file), join(to, file))
  copied += 1
}
console.log(`copy-ort: ${copied} runtime files in public/ort`)
