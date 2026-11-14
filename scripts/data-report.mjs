// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Prints each recomputed number beside the value recorded in the final plan on 14 November 2026.
// It never fails the build. It is for the science lead to read.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recomputeFromRaw } from './lib/verify.mjs'
import { ROOT } from './lib/util.mjs'

const insights = JSON.parse(readFileSync(join(ROOT, 'public/data/insights.json'), 'utf8')).insights
const snapshot = JSON.parse(readFileSync(join(ROOT, 'public/data/snapshot.json'), 'utf8'))
const card = (id) => insights.find((c) => c.id === id).numbers
const raw = recomputeFromRaw(ROOT)
const rows = [
  ['Combustion investigations', snapshot.counts.investigations, 24],
  ['Experimental tables', snapshot.counts.tables, 22],
  ['Table rows', snapshot.counts.rows, 2009],
  ['Highest oxygen in a solid test, percent', card('I1').maxSolidO2Pct, 22.2],
  ['BASS-II tests', card('I1').topInvestigationTests, 129],
  ['Tests inside the Moon Base region', card('I2').moonRegionTests, 66],
  ['Droplet tests on the edge of the region', card('I2').edgeDropletTests, 17],
  ['FLEX tests at or above 30 percent oxygen', card('I2').liquidAtOrAbove30, 24],
  ['d-squared median ratio', card('I4').medianRatio, 0.951],
  ['d-squared tests', card('I4').tests, 196],
  ['Highest oxygen anywhere, percent', card('I10').maxO2Pct, 85],
  ['Tests with an assumed oxygen value', snapshot.counts.testsWithAssumedOxygen, 722],
  ['Raw files: d-squared median ratio', raw.I4.medianRatio, 0.951],
  ['Raw files: Moon Base region', raw.I2.moonRegionTests, 66],
]
console.table(rows.map(([what, now, plan]) => ({ what, now, plan, same: now === plan ? 'yes' : 'NO' })))
