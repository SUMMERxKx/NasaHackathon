// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Every colour comes from a token. Fails if a raw colour is in src outside the token file and the
// fireball's ramp file.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT } from './lib/util.mjs'

const ALLOWED = ['src/styles/theme.css', 'src/three/ramp.ts']
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g
const RGB = /\b(?:rgba?|hsla?)\(\s*\d/g
const problems = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx|css)$/.test(name)) {
      const rel = relative(ROOT, full)
      if (ALLOWED.includes(rel) || /\.test\.tsx?$/.test(name)) continue
      readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
        for (const match of [...line.matchAll(HEX), ...line.matchAll(RGB)]) problems.push(`${rel}:${i + 1} raw colour ${match[0]}`)
      })
    }
  }
}

walk(join(ROOT, 'src'))
if (problems.length > 0) {
  console.error(`check:tokens failed:\n${problems.join('\n')}`)
  process.exit(1)
}
console.log('check:tokens passed. No raw colour in src outside the token file and the ramp file.')
