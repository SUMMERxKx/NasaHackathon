// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The plain English check. No em dash and no semicolon in user-facing text, comments or documents.
// Code syntax is not text. Text quoted from NASA files, such as table headers, is allowed.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT } from './lib/util.mjs'

const EM_DASH = String.fromCharCode(8212)
const SEMI = String.fromCharCode(59)
// Table headers and cell text exactly as NASA wrote them.
const NASA_TEXT = [/composition. mole fraction/, /pressure. mmHg/, /diameter. mm/, /Burning rate(?: constant)?. mm/, /Burn time. s/, /^21. 26\.5. 40$/, /^[,;]$/]
const problems = []
const report = (file, line, what, text) => problems.push(`${relative(ROOT, file)}:${line} ${what}: ${text.trim().slice(0, 90)}`)

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, exts, out)
    else if (exts.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

function checkText(file, line, text, what) {
  if (text.includes(EM_DASH)) report(file, line, `em dash in ${what}`, text)
  if (text.includes(SEMI) && !NASA_TEXT.some((p) => p.test(text))) report(file, line, `semicolon in ${what}`, text)
}

// Pulls the comments and string literals out of JavaScript or TypeScript source.
function scanCode(file) {
  const src = readFileSync(file, 'utf8')
  let i = 0
  let line = 1
  let prev = ''
  // Shader source in a string marked with a glsl comment is code, not text.
  let shaderNext = false
  const stripped = []
  const n = src.length
  const regexAllowed = () => prev === '' || '(,=:[!&|?{+*%~^'.includes(prev) || prev === SEMI || prev === '\n'
  // An apostrophe between two letters is a possessive or a contraction in JSX text, not a string.
  const isWordApostrophe = (at) => src[at] === "'" && /[A-Za-z]/.test(src[at - 1] ?? '') && /[A-Za-z]/.test(src[at + 1] ?? '')
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '\n') {
      line += 1
      stripped.push('\n')
      prev = '\n'
      i += 1
    } else if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i)
      const text = src.slice(i + 2, end < 0 ? n : end)
      checkText(file, line, text, 'a comment')
      i = end < 0 ? n : end
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      const text = src.slice(i + 2, end < 0 ? n : end)
      text.split('\n').forEach((t, k) => checkText(file, line + k, t, 'a comment'))
      if (text.trim() === 'glsl') shaderNext = true
      line += text.split('\n').length - 1
      i = end < 0 ? n : end + 2
    } else if ((c === "'" || c === '"' || c === '`') && !isWordApostrophe(i)) {
      let j = i + 1
      let text = ''
      const startLine = line
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') {
          text += src[j + 1] ?? ''
          j += 2
          continue
        }
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          let depth = 1
          j += 2
          while (j < n && depth > 0) {
            if (src[j] === '{') depth += 1
            else if (src[j] === '}') depth -= 1
            if (src[j] === '\n') line += 1
            j += 1
          }
          text += ' '
          continue
        }
        if (src[j] === '\n') line += 1
        text += src[j]
        j += 1
      }
      if (shaderNext) {
        if (text.includes(EM_DASH)) report(file, startLine, 'em dash in shader source', text)
        shaderNext = false
      } else checkText(file, startLine, text, 'a string')
      stripped.push('""')
      prev = '"'
      i = j + 1
    } else if (c === '/' && regexAllowed()) {
      let j = i + 1
      let inClass = false
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') j += 1
        else if (src[j] === '[') inClass = true
        else if (src[j] === ']') inClass = false
        else if (src[j] === '/' && !inClass) break
        j += 1
      }
      stripped.push('/r/')
      prev = '/'
      i = j + 1
    } else {
      stripped.push(c)
      if (!/\s/.test(c)) prev = c
      i += 1
    }
  }
  // What is left is code and JSX text. JSX text sits between tags and starts with a capital letter.
  stripped.join('').split('\n').forEach((text, k) => {
    if (text.includes(EM_DASH)) report(file, k + 1, 'em dash in text', text)
    if (/>\s*[A-Z][^<>{}=]*;[^<>{}=]*</.test(text)) report(file, k + 1, 'semicolon in text', text)
  })
}

function scanMarkdown(file) {
  let fenced = false
  readFileSync(file, 'utf8').split('\n').forEach((raw, k) => {
    if (raw.trim().startsWith('```')) {
      fenced = !fenced
      return
    }
    if (fenced) return
    const text = raw.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, '')
    checkText(file, k + 1, text, 'a document')
  })
}

function scanJsonStrings(file, pick) {
  const visit = (value, path) => {
    if (typeof value === 'string') {
      if (pick(path, value)) checkText(file, 0, value, `the field ${path.join('.')}`)
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(v, [...path, String(i)]))
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, [...path, k])
  }
  visit(JSON.parse(readFileSync(file, 'utf8')), [])
}

for (const name of ['README.md', 'SOURCES.md', 'SI-DISCLOSURE.md', 'SETUP.md', 'DEMO-NOTES.md']) {
  const file = join(ROOT, name)
  if (existsSync(file)) scanMarkdown(file)
}
for (const dir of ['src', 'server', 'api', 'scripts']) {
  for (const file of walk(join(ROOT, dir), ['.ts', '.tsx', '.mjs'])) {
    // The checker itself has to name the characters it looks for.
    if (!file.endsWith('check-style.mjs')) scanCode(file)
  }
}
scanCode(join(ROOT, 'vite.config.ts'))
for (const file of walk(join(ROOT, 'src'), ['.css'])) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\/\*([\s\S]*?)\*\//g)) checkText(file, 0, match[1], 'a comment')
}
for (const file of walk(join(ROOT, 'data/manual'), ['.json'])) scanJsonStrings(file, (path) => path.at(-1) !== 'url')
// Generated text that EMBER wrote. Text copied from PSI records is NASA's own and is not checked.
scanJsonStrings(join(ROOT, 'public/data/insights.json'), (path) => ['headline', 'detail', 'formula', 'generatedBy'].includes(path.at(-1)))
scanJsonStrings(join(ROOT, 'public/data/evidence.json'), (path, value) => path.at(-1) === 'text' && !/^[A-Za-z0-9 /-]+ \(PSI-\d+\) is the investigation/.test(value))
const html = readFileSync(join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '')
if (html.includes(EM_DASH)) report(join(ROOT, 'index.html'), 0, 'em dash in text', 'index.html')
for (const match of html.matchAll(/content="([^"]*)"/g)) checkText(join(ROOT, 'index.html'), 0, match[1], 'a meta tag')

if (problems.length > 0) {
  console.error(`check:style failed with ${problems.length} problem(s):\n${problems.join('\n')}`)
  process.exit(1)
}
console.log('check:style passed. No em dash and no semicolon in user-facing text, comments or documents.')
