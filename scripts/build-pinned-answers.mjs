// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Writes one pinned answer for each of the six example chips, from live answers on the production site.
// Manual only. Run it after the live answer works: npm run build:pinned -- --site <production address>
// Every answer is written with reviewed set to false. A person must read each one before it is shown.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkAnswer } from '../src/lib/grounding.ts'
import { askSite, loadLocal, prepare, siteArg } from './lib/ask-node.mjs'
import { ROOT, toJson } from './lib/util.mjs'

const site = siteArg()
const local = loadLocal()
const answers = []
for (const chip of local.evalSet.chips) {
  const prepared = prepare(local, chip.question, chip.habitat)
  let done = false
  for (let attempt = 1; attempt <= 3 && !done; attempt += 1) {
    const s = prepared.scenario
    const reply = await askSite(site, { question: chip.question, scenario: { presetId: s.presetId, o2: s.o2, pressurePsi: s.pressurePsi, gravity: s.gravity }, evidenceIds: prepared.ids })
    if (!reply.ok) {
      console.log(`${chip.id}: try ${attempt} failed (${reply.error})`)
      continue
    }
    const check = checkAnswer(reply.text, prepared.pack, prepared.line)
    if (check.verdict !== 'verified') {
      console.log(`${chip.id}: try ${attempt} gave the verdict ${check.verdict}`)
      continue
    }
    answers.push({
      id: chip.id,
      question: chip.question,
      scenario: chip.habitat ? prepared.scenario : null,
      evidenceIds: ['S', ...prepared.ids],
      segments: check.segments.filter((seg) => seg.status === 'kept').map((seg) => ({ text: seg.text, cites: seg.cites })),
      model: reply.meta?.label ?? 'unknown model',
      generatedBy: `Written by ${reply.meta?.label ?? 'a live model'} from EMBER evidence, checked by the answer checker. To be reviewed by the team.`,
      generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      bundleId: local.evidence.bundleId,
      check: { verdict: 'verified', removed: check.removed },
      reviewed: false,
      reviewNote: '',
    })
    console.log(`${chip.id}: pinned, ${check.kept} sentences kept, ${check.removed} removed`)
    done = true
  }
  if (!done) console.warn(`WARNING ${chip.id}: no answer passed the checker in three tries. Nothing was written for this chip.`)
}
const file = {
  schemaVersion: 1,
  generatedBy: 'Written by npm run build:pinned from live model answers on the production site, checked by the answer checker and then reviewed by the team.',
  answers,
}
writeFileSync(join(ROOT, 'public/data/pinned-answers.json'), toJson(file))
console.log(`Wrote ${answers.length} of ${local.evalSet.chips.length} pinned answers. Each has reviewed set to false until a person has read it.`)
