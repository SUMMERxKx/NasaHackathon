// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Runs the evaluation set against the deployed site. Manual only. Never run in a deploy.
// npm run eval:ask -- --site <production address>            tests the first choice
// npm run eval:ask -- --site <production address> --use backup   tests the backup on purpose
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkAnswer, hasVerdictLanguage } from '../src/lib/grounding.ts'
import { askSite, loadLocal, prepare, siteArg } from './lib/ask-node.mjs'
import { ROOT, toJson } from './lib/util.mjs'

const site = siteArg()
const useBackup = process.argv.includes('--use') && process.argv[process.argv.indexOf('--use') + 1] === 'backup'
const local = loadLocal()
const rows = []
const full = []
const times = []
let sentences = 0
let keptSentences = 0
let verdictSlips = 0

for (const q of [...local.evalSet.real, ...local.evalSet.trick]) {
  const prepared = prepare(local, q.question, q.habitat)
  if (!prepared.result.hasEvidence) {
    rows.push({ n: q.n, verdict: 'gate', kept: 0, removed: 0, model: 'none', note: 'Stopped by the no-evidence gate. No model call.' })
    continue
  }
  for (let round = 1; round <= 3; round += 1) {
    const s = prepared.scenario
    const reply = await askSite(site, { question: q.question, scenario: { presetId: s.presetId, o2: s.o2, pressurePsi: s.pressurePsi, gravity: s.gravity }, evidenceIds: prepared.ids, ...(useBackup ? { use: 'backup' } : {}) })
    if (!reply.ok) {
      rows.push({ n: q.n, verdict: 'failed', kept: 0, removed: 0, model: 'none', note: reply.error })
      continue
    }
    const check = checkAnswer(reply.text, prepared.pack, prepared.line)
    const kept = check.segments.filter((seg) => seg.status === 'kept')
    sentences += check.segments.length
    keptSentences += kept.length
    verdictSlips += kept.filter((seg) => hasVerdictLanguage(seg.text)).length
    times.push(reply.ms)
    rows.push({ n: q.n, verdict: check.verdict, kept: check.kept, removed: check.removed, model: reply.meta?.model ?? '', note: check.segments.filter((seg) => seg.reason).map((seg) => seg.reason).join(' ') })
    full.push({ n: q.n, question: q.question, round, model: reply.meta?.label, text: reply.text, check })
  }
}

console.table(rows)
const real = rows.filter((r) => typeof r.n === 'number')
const perQuestion = new Map()
for (const r of real) perQuestion.set(r.n, (perQuestion.get(r.n) ?? 0) + (r.verdict === 'verified' ? 1 : 0))
const answered = [...perQuestion.values()].filter((v) => v >= 2).length
times.sort((a, b) => a - b)
console.log(`Model path: ${useBackup ? 'backup' : 'first choice'}`)
console.log(`Answer rate: ${answered} of ${perQuestion.size} real questions verified in at least 2 of 3 rounds`)
console.log(`Raw sentence quality: ${sentences === 0 ? 0 : Math.round((keptSentences / sentences) * 100)} percent of ${sentences} sentences passed the checker`)
console.log(`Verdict language in kept sentences: ${verdictSlips}`)
console.log(`Median time to a complete answer: ${times.length ? Math.round(times[Math.floor(times.length / 2)] / 100) / 10 : 0} seconds`)
const dir = join(ROOT, 'eval-results')
mkdirSync(dir, { recursive: true })
const name = `eval-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}${useBackup ? '-backup' : ''}.json`
writeFileSync(join(dir, name), toJson({ site, useBackup, rows, answers: full }))
console.log(`Full answers written to eval-results/${name} for the science lead to read. Copy the summary into src/config/evaluation.ts.`)
