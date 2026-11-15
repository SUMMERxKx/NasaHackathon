// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Two levels of insight verification.
// Level 1 recomputes every number from the snapshot.
// Level 2 recomputes the headline cards straight from the raw CSV files with its own short code.
// Level 2 does not use the normalizer or the shared number parser, so it can catch their bugs.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { csvParseRows } from 'd3-dsv'
import { buildInsightList } from './insights.mjs'

function rawTable(root, ending) {
  const dir = join(root, 'data/raw/tables')
  const file = readdirSync(dir).find((f) => f.endsWith(ending))
  if (!file) throw new Error(`Raw table not found: ${ending}`)
  const bytes = readFileSync(join(dir, file))
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  const rows = csvParseRows(text.replace(/^﻿/, ''))
  const headers = rows[0].map((h) => h.replace(/\s+/g, ' ').trim())
  const col = (name) => {
    const index = headers.findIndex((h) => h.toLowerCase().startsWith(name.toLowerCase()))
    if (index < 0) throw new Error(`Column not found: ${name} in ${file}`)
    return index
  }
  const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''))
  return { data, col }
}

// Strict on purpose: a cell counts only if the whole cell is a plain number.
const strict = (cell) => {
  const text = String(cell ?? '').trim()
  return /^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(text) ? Number(text) : null
}

const quantile = (values, q) => {
  const s = [...values].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

const r = (value, digits) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits

export function recomputeFromRaw(root) {
  const out = {}

  // Card 1. The highest oxygen in BASS-II, read as a plain percent.
  const bass2 = rawTable(root, '_BASS-II.csv')
  const bassO2 = bass2.data.map((row) => strict(row[bass2.col('Calibrated initial O2')])).filter((v) => v != null)
  out.I1 = {
    maxSolidO2Pct: r(Math.max(...bassO2), 3),
    topInvestigationTests: bass2.data.length,
    solidTestsAtOrAbove30: bassO2.filter((v) => v >= 30).length,
  }

  // Card 2. Tests at or above 30 percent oxygen, and the Moon Base region, table by table.
  const gasTables = [
    { ending: '_Flame Design_Normal Flame.csv', o2: 'XO2 (init)', p: 'pmean (atm)', pAlt: 'pinit (atm)', toPsi: 14.696 },
    { ending: '_Flame Design_Inverse Flame.csv', o2: 'XO2', p: 'pmean (atm)', toPsi: 14.696 },
    { ending: '_CFI-G_Normal Flames.csv', o2: 'XO2 before test', p: 'approx p (bar)', toPsi: 0.98692 * 14.696 },
    { ending: '_CFI-G_Inverse Flames.csv', o2: 'XO2', p: 'approx p (bar)', toPsi: 0.98692 * 14.696 },
  ]
  let gasHigh = 0
  let moon = 0
  let maxO2 = 0
  let atMax = 0
  const allO2 = []
  for (const spec of gasTables) {
    const table = rawTable(root, spec.ending)
    for (const row of table.data) {
      const o2 = strict(row[table.col(spec.o2)])
      if (o2 == null) continue
      allO2.push(o2)
      if (o2 < 0.3 - 1e-9) continue
      gasHigh += 1
      let p = strict(row[table.col(spec.p)])
      if (p == null && spec.pAlt) p = strict(row[table.col(spec.pAlt)])
      if (p != null && Math.round(p * spec.toPsi * 10) / 10 <= 10.2) moon += 1
    }
  }
  const flex = rawTable(root, '_FLEX.csv')
  let flexHigh = 0
  let edge = 0
  let flexMoon = 0
  for (const row of flex.data) {
    const o2 = strict(row[flex.col('O initial ambient composition')])
    if (o2 == null) continue
    allO2.push(o2)
    if (o2 < 0.3 - 1e-9) continue
    flexHigh += 1
    const mmHg = strict(row[flex.col('Ambient pressure')])
    if (mmHg == null || mmHg <= 0) continue
    const psi = Math.round((mmHg / 760) * 14.696 * 10) / 10
    if (psi <= 10.2) flexMoon += 1
    else if (psi <= 10.2 * 1.05) edge += 1
  }
  maxO2 = Math.max(...allO2)
  atMax = allO2.filter((v) => v >= maxO2 - 0.0005).length
  out.I2 = {
    moonRegionTests: moon + flexMoon,
    moonRegionGas: moon,
    moonRegionLiquid: flexMoon,
    edgeDropletTests: edge,
    liquidAtOrAbove30: flexHigh,
  }
  out.I2_gasFromFourTables = gasHigh

  // Card 4. The d-squared law against FLEX.
  const ratios = []
  for (const row of flex.data) {
    const d0 = strict(row[flex.col('Droplet initial diameter')])
    const dExt = strict(row[flex.col('Visible flame extinction diameter')])
    const k = strict(row[flex.col('Burning rate')])
    const time = strict(row[flex.col('Burn time')])
    if (d0 == null || dExt == null || k == null || time == null) continue
    if (d0 <= 0 || k <= 0 || time <= 0) continue
    ratios.push((d0 * d0 - dExt * dExt) / k / time)
  }
  out.I4 = { medianRatio: r(quantile(ratios, 0.5), 3), q1: r(quantile(ratios, 0.25), 3), q3: r(quantile(ratios, 0.75), 3), tests: ratios.length }

  // Card 10. The highest oxygen anywhere.
  out.I10 = { maxO2Pct: r(maxO2 * 100, 1), testsAtMax: atMax }
  return out
}

// Returns the insight list with the verified field set, or throws with a list of mismatches.
export function verifyInsights(snapshot, insights, root) {
  const problems = []
  const fresh = buildInsightList(snapshot)
  for (const card of insights) {
    const again = fresh.find((c) => c.id === card.id)
    if (!again) {
      problems.push(`${card.id}: not produced by a fresh build`)
      continue
    }
    for (const [key, value] of Object.entries(card.numbers)) {
      if (again.numbers[key] !== value) problems.push(`${card.id}.${key}: card says ${value}, snapshot gives ${again.numbers[key]}`)
    }
  }
  const raw = recomputeFromRaw(root)
  const twice = new Set()
  for (const id of ['I1', 'I2', 'I4', 'I10']) {
    const card = insights.find((c) => c.id === id)
    if (!card) {
      problems.push(`${id}: missing`)
      continue
    }
    for (const [key, value] of Object.entries(raw[id])) {
      if (card.numbers[key] !== value) problems.push(`${id}.${key}: card says ${card.numbers[key]}, raw files give ${value}`)
    }
    twice.add(id)
  }
  // The gas count on card 2 also includes day-level rows from ACME BRE and s-Flame, so the raw check
  // covers the four tables that state oxygen per test and must not exceed the card's count.
  const i2 = insights.find((c) => c.id === 'I2')
  if (i2 && raw.I2_gasFromFourTables > i2.numbers.gasAtOrAbove30) {
    problems.push(`I2.gasAtOrAbove30: raw files give at least ${raw.I2_gasFromFourTables}, card says ${i2.numbers.gasAtOrAbove30}`)
  }
  if (problems.length > 0) throw new Error(`Insight verification failed:\n${problems.join('\n')}`)
  return insights.map((c) => ({ ...c, verified: twice.has(c.id) ? 'snapshot and raw files' : 'snapshot' }))
}
