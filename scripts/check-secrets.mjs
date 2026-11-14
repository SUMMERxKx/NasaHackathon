// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Scans the built site and the repository for key-shaped strings. It never prints a match in full.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT } from './lib/util.mjs'

const KEY = /(?<![A-Za-z0-9])sk-(?:or-)?[A-Za-z0-9_-]{24,}/g
const LONG_RUN = /(?<![A-Za-z0-9+/=_-])(?:[0-9a-fA-F]{32,}|[A-Za-z0-9+/_-]{40,}={0,2})(?![A-Za-z0-9+/=_-])/g
const CONFIG_FILES = ['vercel.json', 'package.json', 'tsconfig.json', '.env.example', 'vite.config.ts', 'index.html']
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', 'dist'])
const TEXT = /\.(js|mjs|ts|tsx|json|html|css|md|txt|csv|svg|map|example)$/
const problems = []
const liveKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.length >= 16 ? process.env.OPENROUTER_API_KEY : null

function scan(file, inDist) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(KEY)) problems.push(`${rel}: a key-shaped string starting ${match[0].slice(0, 6)}...`)
  if (liveKey && text.includes(liveKey)) problems.push(`${rel}: holds the value of OPENROUTER_API_KEY`)
  if (inDist && /VITE_[A-Z_]*(KEY|SECRET|TOKEN)/.test(text)) problems.push(`${rel}: names a VITE_ variable that looks like a secret`)
  if (!inDist && CONFIG_FILES.includes(rel)) {
    for (const match of text.matchAll(LONG_RUN)) problems.push(`${rel}: a long random-looking string starting ${match[0].slice(0, 6)}...`)
  }
}

function walk(dir, inDist) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (!inDist && SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, inDist)
    else if ((TEXT.test(name) || name.startsWith('.env')) && stat.size < 8_000_000 && name !== 'package-lock.json') scan(full, inDist)
  }
}

walk(ROOT, false)
walk(join(ROOT, 'dist'), true)
if (problems.length > 0) {
  console.error(`check:secrets failed:\n${[...new Set(problems)].join('\n')}`)
  process.exit(1)
}
console.log(`check:secrets passed. No key-shaped string in the repository${existsSync(join(ROOT, 'dist')) ? ' or the built site' : ''}.`)
