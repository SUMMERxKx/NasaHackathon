// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Drill-through. One function decides which tests lie behind any chart mark or sourced number.
// The charts and the drill panel both call it, so their counts cannot differ.
import type {
  DrillGroup,
  DrillPath,
  DrillResult,
  DrillStep,
  FuelClass,
  Habitat,
  Insight,
  Investigation,
  MethodConstants,
  NearbySubset,
  Pillar,
  Scenario,
  Test,
} from '../types.ts'
import {
  COVERAGE_FORMULA,
  DEFAULT_METHOD,
  PILLARS,
  distance,
  isAssumed,
  pillarFactor,
  scenarioPoint,
  scoreFromEffective,
  testWeight,
} from './coverage.ts'
import type { PillarLookup, Point } from './coverage.ts'
import { D_SQUARED_FORMULA, validateDSquared } from './droplet.ts'
import { flameLookup } from './flame.ts'
import { burnLengthPairs, dropletSelection, extinctionBins, flexTests, parseDropletKey } from './lab.ts'
import { FUEL_FILTERS, FUEL_LABEL, FUEL_WORD, NEARBY_FUELS, NEARBY_RULE, NEARBY_SUBSETS, isInverseFlame, nearbyTests } from './nearby.ts'
import { inScope, makeScope, scopeActive, scopeLabel } from './mapScope.ts'
import { RANK_FORMULAS } from './ranking.ts'
import { inMoonRegion, moonCounts, onMoonEdge } from './regions.ts'
import { byAccession, countBy } from './stats.ts'
import { atmToPsi, formatNumber, formatPercent } from './units.ts'

export type DrillData = {
  tests: Test[]
  testById: Map<string, Test>
  testsByAcc: Record<string, Test[]>
  invByAcc: Record<string, Investigation>
  insights: Insight[]
  habitats: Habitat[]
  lookup: PillarLookup
  // Hardware family names, for the words of a map filter.
  hardwareName?: Record<string, string>
}

// A test counts as "nearby" in a coverage drill when its weight is at least this much.
export const COUNTED_WEIGHT = 0.01

const READOUTS = ['burningRate', 'outcomes', 'flameTemperature', 'nearest'] as const
const CHARTS = ['dsquared', 'validation', 'extinction', 'burnLength'] as const
const PARTS = ['A', 'F', 'P', 'D'] as const

const n4 = (value: number): string => String(Math.round(value * 10000) / 10000)
const esc = (text: string): string => encodeURIComponent(text).replace(/~/g, '%7E').replace(/\./g, '%2E')

export function encodeStep(step: DrillStep): string {
  switch (step.kind) {
    case 'coverage': return `coverage.${step.pillar}`
    case 'region': return `region.${step.id}`
    case 'near': return `near.${n4(step.o2)},${n4(step.pressureAtm)}${step.fuel ? `,${step.fuel}` : ''}${step.only ? `,${step.only}` : ''}`
    case 'stack': return `stack.${n4(step.o2)},${n4(step.pressureAtm)}`
    case 'rank': return `rank.${step.accession},${step.part}`
    case 'insight': return `insight.${step.id}.${step.number}`
    case 'column': return `column.${step.accession},${step.table},${step.column},${esc(step.value)}`
    case 'fireball': return `fireball.${step.readout}`
    case 'bin': return `bin.${step.chart},${esc(step.key)}`
    case 'investigation': return `inv.${step.accession}`
    case 'test': return `test.${step.id}`
    // The search, when there is one, is a fifth part written q=, so a four-part address still reads.
    case 'scope': return `scope.${step.pillar ?? ''},${step.fuel ?? ''},${step.inv ?? ''},${step.hw ?? ''}${step.q ? `,q=${esc(step.q)}` : ''}`
  }
}

export function encodeDrill(path: DrillPath): string {
  return path.map(encodeStep).join('~')
}

const ACCESSION = /^PSI-\d+$/
const TEST_ID = /^PSI-\d+:\d+:\d+[a-z]?$/
const num = (text: string | undefined): number | null => {
  if (text == null || text === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function decodeStep(text: string): DrillStep | null {
  const dot = text.indexOf('.')
  if (dot < 1) return null
  const kind = text.slice(0, dot)
  const value = text.slice(dot + 1)
  if (value === '') return null
  try {
    switch (kind) {
      case 'coverage':
        return value === 'overall' || PILLARS.includes(value as Pillar) ? { kind, pillar: value as Pillar | 'overall' } : null
      case 'region':
        return value === 'moon' ? { kind, id: 'moon' } : null
      case 'near':
      case 'stack': {
        const [a, b, ...rest] = value.split(',')
        const o2 = num(a)
        const p = num(b)
        if (o2 == null || p == null || o2 < 0 || o2 > 1 || p <= 0 || p >= 10) return null
        if (kind === 'stack') return rest.length === 0 ? { kind, o2, pressureAtm: p } : null
        // A nearby step may name one fuel class, then one subset. Anything else does not decode.
        const step: Extract<DrillStep, { kind: 'near' }> = { kind, o2, pressureAtm: p }
        if (FUEL_FILTERS.includes(rest[0] as FuelClass)) step.fuel = rest.shift() as FuelClass
        if (NEARBY_SUBSETS.includes(rest[0] as NearbySubset)) step.only = rest.shift() as NearbySubset
        return rest.length === 0 ? step : null
      }
      case 'rank': {
        const [accession, part] = value.split(',')
        return ACCESSION.test(accession) && PARTS.includes(part as 'A') ? { kind, accession, part: part as 'A' } : null
      }
      case 'insight': {
        const split = value.indexOf('.')
        const id = split < 0 ? value : value.slice(0, split)
        const number = split < 0 ? '' : value.slice(split + 1)
        return /^I\d+$/.test(id) && /^[A-Za-z0-9]*$/.test(number) ? { kind, id, number } : null
      }
      case 'column': {
        const parts = value.split(',')
        if (parts.length < 4) return null
        const table = num(parts[1])
        const column = num(parts[2])
        if (!ACCESSION.test(parts[0]) || table == null || column == null) return null
        return { kind, accession: parts[0], table, column, value: decodeURIComponent(parts.slice(3).join(',')) }
      }
      case 'fireball':
        return READOUTS.includes(value as 'nearest') ? { kind, readout: value as 'nearest' } : null
      case 'bin': {
        const comma = value.indexOf(',')
        if (comma < 1) return null
        const chart = value.slice(0, comma)
        return CHARTS.includes(chart as 'dsquared') ? { kind, chart: chart as 'dsquared', key: decodeURIComponent(value.slice(comma + 1)) } : null
      }
      case 'inv':
        return ACCESSION.test(value) ? { kind: 'investigation', accession: value } : null
      case 'test':
        return TEST_ID.test(value) ? { kind: 'test', id: value } : null
      case 'scope': {
        const [pillar, fuel, inv, hw, search, ...rest] = value.split(',')
        if (rest.length > 0 || hw == null) return null
        if (search != null && !/^q=./.test(search)) return null
        const q = search == null ? '' : decodeURIComponent(search.slice(2))
        const scope = makeScope({ pillar, fuel, inv, hw, q })
        // Every part given must be well formed, and at least one must be given.
        const given = [pillar, fuel, inv, hw, q].filter(Boolean).length
        if (!scopeActive(scope) || Object.keys(scope).length !== given) return null
        return { kind: 'scope', ...scope }
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

// An address that does not decode opens no panel and shows no error.
export function decodeDrill(text: string | null | undefined): DrillPath | null {
  if (!text) return null
  const parts = text.split('~')
  if (parts.length < 1 || parts.length > 4) return null
  const path: DrillPath = []
  for (const part of parts) {
    const step = decodeStep(part)
    if (!step) return null
    path.push(step)
  }
  return path
}

type Mark = {
  title: string
  label: string
  formula: string | null
  note: string | null
  tests: Test[]
  edge: Test[]
  highlight: string | null
  effective?: Record<string, number>
  links?: { label: string; to: string }[]
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`
const byNearest = (tests: Test[], point: Point, m: MethodConstants): Test[] =>
  tests
    .map((t) => ({ t, d: distance(t, point, m) ?? Infinity }))
    .sort((a, b) => a.d - b.d || (a.t.id < b.t.id ? -1 : 1))
    .map((x) => x.t)

function classCounts(tests: Test[]): string {
  const c = countBy(tests, (t) => t.fuelClass)
  return `${c.solid || 0} solid, ${c.liquid || 0} liquid, ${c.gas || 0} gas`
}

// All four classes, so the parts add up to the total in the title.
function nearbyClassCounts(tests: Test[]): string {
  const c = countBy(tests, (t) => t.fuelClass)
  const parts = NEARBY_FUELS.map((fuel) => `${c[fuel] || 0} ${fuel === 'aerosol' ? 'smoke and aerosol' : fuel}`)
  if (c.unknown) parts.push(`${c.unknown} not classed`)
  return parts.join(', ')
}

// Where to go from a nearby subset with no rows in it.
const EMPTY_NEARBY_LINKS = [
  { label: 'All investigations', to: '/investigations' },
  { label: 'Evidence gap findings', to: '/about?section=findings' },
  { label: 'How nearby is defined', to: '/about?section=nearby' },
]

export function pointLabel(point: Point): string {
  return `${formatPercent(point.o2)} oxygen and ${formatNumber(atmToPsi(point.pressureAtm), 1)} psi`
}

// The tests behind one mark. Every chart builds its counts from this same function.
export function resolveMark(step: DrillStep, data: DrillData, scenario: Scenario, m: MethodConstants = DEFAULT_METHOD): Mark {
  const point = scenarioPoint(scenario)
  const empty: Mark = { title: '', label: '', formula: null, note: null, tests: [], edge: [], highlight: null }
  switch (step.kind) {
    case 'coverage': {
      const pillars = step.pillar === 'overall' ? PILLARS : [step.pillar]
      const effective: Record<string, number> = {}
      const counted: Test[] = []
      let total = 0
      for (const t of data.tests) {
        const w = testWeight(t, point, m)
        if (w === 0) continue
        let f = 0
        for (const p of pillars) f += pillarFactor(data.lookup[t.accession], p, m) * (step.pillar === 'overall' ? m.pillarWeights[p] : 1)
        if (f === 0) continue
        effective[t.accession] = (effective[t.accession] || 0) + f * w
        total += f * w
        if (w >= COUNTED_WEIGHT) counted.push(t)
      }
      const name = step.pillar === 'overall' ? 'Overall' : step.pillar[0].toUpperCase() + step.pillar.slice(1)
      const title =
        step.pillar === 'overall'
          ? `Overall Evidence Coverage near ${pointLabel(point)}, from ${plural(counted.length, 'nearby test')}. Not a safety rating.`
          : `${name} coverage near ${pointLabel(point)} is ${Math.round(scoreFromEffective(total, m))} out of 100, from ${formatNumber(total, 1)} effective tests. Not a safety rating.`
      return {
        ...empty,
        title,
        label: `${name} coverage`,
        formula:
          step.pillar === 'overall'
            ? `${COVERAGE_FORMULA} overall = 0.4 × prevention + 0.3 × detection + 0.3 × suppression.`
            : COVERAGE_FORMULA,
        note: counted.length === 0 ? 'No flight test sits near this atmosphere. That gap is the finding.' : null,
        tests: byNearest(counted, point, m),
        effective,
      }
    }
    case 'region': {
      const inside = data.tests.filter(inMoonRegion)
      const edge = data.tests.filter(onMoonEdge)
      const edgeDroplets = edge.filter((t) => t.fuelClass === 'liquid').length
      const counts = moonCounts(inside)
      const inverse = counts.inverse > 0 ? ` ${counts.inverse === counts.gas && counts.gas > 1 ? 'All' : counts.inverse} of the ${plural(counts.gas, 'gas flame test')} ${counts.inverse === 1 ? 'is an inverse flame' : 'are inverse flames'}, whose oxygen is the burner stream, not the chamber.` : ''
      return {
        ...empty,
        title: `${plural(inside.length, 'test')} inside the Moon Base region: ${classCounts(inside)}.${inverse} ${plural(edgeDroplets, 'droplet test')} on its edge.`,
        label: 'Moon Base region',
        formula: 'Inside means the table states oxygen of 30% or more and a pressure of 10.2 psi or less. On the edge means within 5% above that pressure line.',
        tests: inside,
        edge,
      }
    }
    case 'near': {
      const at = { o2: step.o2, pressureAtm: step.pressureAtm }
      const list = byNearest(nearbyTests(data.tests, at, { fuel: step.fuel, only: step.only }, m), at, m)
      const where = `within one unit of ${pointLabel(at)}`
      // The words for this subset, as they read before the word test.
      const kind = [step.fuel ? FUEL_WORD[step.fuel] : '', step.only === 'inverse' ? 'inverse-flame' : ''].filter(Boolean).join(' ')
      const tail = step.only === 'assumed' ? ' with an assumed oxygen or pressure value' : ''
      const narrowed = Boolean(step.fuel || step.only)
      const inverse = list.filter(isInverseFlame).length
      const title = narrowed
        ? list.length === 0
          ? `No ${kind ? `${kind} ` : ''}test${tail} ${where}.`
          : `${plural(list.length, `${kind ? `${kind} ` : ''}test`)}${tail} ${where}.`
        : `${plural(list.length, 'test')} ${where}: ${nearbyClassCounts(list)}.`
      const note =
        list.length === 0
          ? `${narrowed ? 'No row of this kind' : 'No test record'} in the snapshot meets the nearby rule here. That is an evidence gap, not proof of safety or danger.`
          : step.only === 'inverse'
            ? 'An inverse flame burns a jet of oxidizer inside fuel. The oxygen value of these rows is the oxidizer stream, not a cabin atmosphere.'
            : step.only === 'assumed'
              ? 'The tables for these tests do not state an atmosphere. EMBER places them with a declared assumption.'
              : inverse > 0
                ? `${inverse} of these ${inverse === 1 ? 'is an inverse flame' : 'are inverse flames'}. Their oxygen value is the oxidizer stream, not a cabin atmosphere.`
                : null
      const labelParts = [step.fuel ? FUEL_LABEL[step.fuel].toLowerCase() : '', step.only === 'assumed' ? 'assumed values' : step.only === 'inverse' ? 'inverse flames' : ''].filter(Boolean)
      return {
        ...empty,
        title,
        label: `Near ${formatPercent(at.o2)}, ${formatNumber(atmToPsi(at.pressureAtm), 1)} psi${labelParts.length > 0 ? `, ${labelParts.join(', ')}` : ''}`,
        formula: NEARBY_RULE,
        note,
        tests: list,
        links: list.length === 0 ? EMPTY_NEARBY_LINKS : [],
      }
    }
    case 'stack': {
      const list = data.tests.filter(
        (t) => t.o2 != null && t.pressureAtm != null && Math.abs(t.o2 - step.o2) < 5e-5 && Math.abs(t.pressureAtm - step.pressureAtm) < 5e-5,
      )
      const assumed = list.filter(isAssumed).length
      return {
        ...empty,
        title: `${plural(list.length, 'test')} share the point ${pointLabel(step)}.${assumed > 0 ? ` ${assumed} rest on an assumed value.` : ''}`,
        label: `Stack at ${formatPercent(step.o2)}, ${formatNumber(atmToPsi(step.pressureAtm), 1)} psi`,
        note: assumed === list.length && list.length > 0 ? 'Hollow marks are assumed cabin air. The tables for these tests do not state an atmosphere.' : null,
        tests: list,
      }
    }
    case 'rank': {
      const inv = data.invByAcc[step.accession]
      const own = data.testsByAcc[step.accession] || []
      const info = RANK_FORMULAS[step.part]
      const name = inv?.displayName ?? step.accession
      if (step.part === 'A') {
        const counted = byNearest(own.filter((t) => testWeight(t, point, m) >= COUNTED_WEIGHT), point, m)
        return {
          ...empty,
          title: `${info.label} for ${name}: ${plural(counted.length, 'test')} of its ${own.length} counted near ${pointLabel(point)}.`,
          label: `${name}, ${info.label.toLowerCase()}`,
          formula: info.formula,
          note: own.length === 0 ? 'This investigation has no test table in PSI, so there are no rows behind this bar.' : counted.length === 0 ? 'None of its tests sit near this atmosphere.' : null,
          tests: counted,
        }
      }
      if (step.part === 'D') {
        return {
          ...empty,
          title: `${info.label} for ${name}: ${plural(own.length, 'test')} in its PSI table.`,
          label: `${name}, ${info.label.toLowerCase()}`,
          formula: info.formula,
          note: own.length === 0 ? 'This investigation has no test table in PSI, so there are no rows behind this bar.' : null,
          tests: own,
        }
      }
      return {
        ...empty,
        title: `${info.label} for ${name}.`,
        label: `${name}, ${info.label.toLowerCase()}`,
        formula: info.formula,
        note: 'There are no rows behind this bar. It comes from a rule and the investigation\'s own record.',
      }
    }
    case 'insight': {
      const card = data.insights.find((c) => c.id === step.id)
      if (!card) return { ...empty, title: 'This insight is not in the current data.', label: step.id, note: 'Nothing to show.' }
      const key = step.number && card.display[step.number] != null ? step.number : card.primary
      const idsFor = card.byNumber[key]
      const all = idsFor ?? card.evidence.flatMap((e) => e.testIds ?? [])
      const tests = all.map((id) => data.testById.get(id)).filter((t): t is Test => Boolean(t))
      return {
        ...empty,
        title: `${card.display[key]}: ${card.headline}`,
        label: `Insight ${card.id}`,
        formula: card.formula ?? null,
        note: tests.length === 0 ? 'There are no test rows behind this number. It comes from the investigation records.' : null,
        tests,
        highlight: card.highlight && all.includes(card.highlight) ? card.highlight : null,
      }
    }
    case 'column': {
      const own = (data.testsByAcc[step.accession] || []).filter((t) => t.id.split(':')[1] === String(step.table))
      const header = own[0] ? Object.keys(own[0].raw)[step.column] : undefined
      const name = data.invByAcc[step.accession]?.displayName ?? step.accession
      if (!header) return { ...empty, title: 'This column is not in the current data.', label: name, note: 'Nothing to show.' }
      const want = step.value.replace(/\s+/g, ' ').trim()
      const list = want === '*' ? own.filter((t) => (t.raw[header] ?? '').trim() !== '') : own.filter((t) => (t.raw[header] ?? '').replace(/\s+/g, ' ').trim() === want)
      return {
        ...empty,
        title: want === '*' ? `${plural(list.length, 'test')} of ${name} with a value in the column "${header}".` : `${plural(list.length, 'test')} of ${name} where "${header}" is "${want}".`,
        label: `${name}, ${header}`,
        tests: list,
      }
    }
    case 'fireball': {
      const look = flameLookup(data.tests, point)
      if (step.readout === 'burningRate') {
        return {
          ...empty,
          title: look.burningRate.tests.length > 0
            ? `Burning rate near ${formatPercent(point.o2)} oxygen: ${formatNumber(look.burningRate.value as number, 3)}, the median of ${plural(look.burningRate.tests.length, 'nitrogen-diluted FLEX test')}.`
            : `No nitrogen-diluted FLEX test within 3 points of ${formatPercent(point.o2)} oxygen.`,
          label: 'Fireball, burning rate',
          formula: 'The median of the burning rate column over nitrogen-diluted FLEX tests within 3 points of oxygen.',
          note: look.burningRate.tests.length === 0 ? 'There are no rows behind this number here. The fireball uses a value between the nearest tested oxygen levels.' : null,
          tests: look.burningRate.tests,
        }
      }
      if (step.readout === 'outcomes') {
        return {
          ...empty,
          title: `Ended in extinction: ${look.extinction.ended.length} of ${plural(look.extinction.of.length, 'FLEX test')} within 3 points of ${formatPercent(point.o2)} oxygen.`,
          label: 'Fireball, outcomes',
          formula: 'A count of the Test end column over FLEX tests within 3 points of oxygen.',
          note: look.extinction.of.length === 0 ? 'No FLEX test sits near this oxygen level.' : null,
          tests: look.extinction.of,
        }
      }
      if (step.readout === 'flameTemperature') {
        return {
          ...empty,
          title: look.flameTemperature.tests.length > 0
            ? `Listed flame temperature for gas flames near ${formatPercent(point.o2)} oxygen: ${formatNumber(look.flameTemperature.value as number, 0)} K, the median of ${plural(look.flameTemperature.tests.length, 'ACME test')}.`
            : `No ACME gas flame test within 5 points of ${formatPercent(point.o2)} oxygen lists a flame temperature.`,
          label: 'Fireball, flame temperature',
          formula: 'The median of the column headed Tad (K) over ACME gas flame tests within 5 points of oxygen. It is a calculated upper temperature for gas flames.',
          note: look.flameTemperature.tests.length === 0 ? 'There are no rows behind this number here.' : null,
          tests: look.flameTemperature.tests,
        }
      }
      const nearest = look.nearestDroplet
      return {
        ...empty,
        title: look.dropletsInRange.length > 0
          ? `${plural(look.dropletsInRange.length, 'droplet test')} within one unit of ${pointLabel(point)}.`
          : `No droplet test within range of ${pointLabel(point)}.${nearest ? ` The nearest ran at ${pointLabel({ o2: nearest.test.o2 as number, pressureAtm: nearest.test.pressureAtm as number })}.` : ''}`,
        label: 'Fireball, droplet tests in range',
        formula: 'One unit of distance is 4 points of oxygen or about 25 percent in pressure.',
        tests: look.dropletsInRange.length > 0 ? look.dropletsInRange : nearest ? [nearest.test] : [],
      }
    }
    case 'bin': {
      if (step.chart === 'dsquared') {
        const key = parseDropletKey(step.key)
        const sel = key ? dropletSelection(data.tests, key.fuel, key.o2, key.family) : null
        return {
          ...empty,
          title: sel && key
            ? `${plural(sel.tests.length, 'FLEX test')} of ${key.fuel.toLowerCase()} in ${key.family} within 3 points of ${formatPercent(key.o2)} oxygen.${sel.k != null ? ` Median burning rate ${formatNumber(sel.k, 3)}.` : ''}`
            : 'This selection is not in the current data.',
          label: 'd-squared line',
          formula: D_SQUARED_FORMULA,
          note: sel && !sel.enough ? 'Not enough tests near this condition. No line is drawn.' : null,
          tests: sel?.tests ?? [],
        }
      }
      if (step.chart === 'validation') {
        const v = validateDSquared(flexTests(data.tests))
        const list = v.points.map((p) => data.testById.get(p.testId)).filter((t): t is Test => Boolean(t))
        return {
          ...empty,
          title: `${plural(list.length, 'FLEX test')} with a starting diameter, an extinction diameter, a burning rate and a burn time. Median of predicted over measured: ${formatNumber(v.median ?? 0, 3)}.`,
          label: 'd-squared validation',
          formula: D_SQUARED_FORMULA,
          tests: list,
        }
      }
      if (step.chart === 'extinction') {
        const fuel = step.key.split('|')[0]
        const bin = extinctionBins(data.tests, fuel).find((b) => b.key === step.key)
        const list = (bin?.testIds ?? []).map((id) => data.testById.get(id)).filter((t): t is Test => Boolean(t))
        return {
          ...empty,
          title: bin
            ? `${plural(list.length, `${fuel.toLowerCase()} test`)} at ${formatPercent(bin.min, 0)} to ${formatPercent(bin.max, 0)} oxygen.${bin.median != null ? ` Median extinction ratio ${formatNumber(bin.median, 2)}.` : ''}`
            : 'This bin is not in the current data.',
          label: 'Extinction bin',
          formula: 'Extinction ratio = flame-out diameter ÷ starting diameter. Near 1 means the flame went out almost at once. 0 means the droplet burned away.',
          note: list.length === 0 ? 'No test falls in this bin.' : null,
          tests: list,
        }
      }
      const pair = burnLengthPairs(data.tests).find((p) => p.testId === step.key)
      const test = pair ? data.testById.get(pair.testId) : undefined
      return {
        ...empty,
        title: pair ? `Saffire-II sample ${pair.label}, ${pair.material}: microgravity burn length "${pair.ugRaw}", normal gravity "${pair.g1Raw}".` : 'This sample is not in the current data.',
        label: 'Burn length pair',
        tests: test ? [test] : [],
      }
    }
    case 'investigation': {
      const own = data.testsByAcc[step.accession] || []
      const name = data.invByAcc[step.accession]?.displayName ?? step.accession
      return { ...empty, title: `${plural(own.length, 'test')} in the PSI table of ${name}.`, label: name, tests: own, note: own.length === 0 ? 'This investigation has no test table in PSI.' : null }
    }
    case 'test': {
      const test = data.testById.get(step.id)
      return { ...empty, title: test ? `Test ${test.label}` : 'This test is not in the current data.', label: test ? `Test ${test.label}` : step.id, tests: test ? [test] : [] }
    }
    case 'scope':
      return empty
  }
}

/** The mark of a path and the map filter it was drawn under, if any. Every crumb and link starts here. */
export function drillHead(path: DrillPath): DrillPath {
  const first = path[0]
  const scope = path[1]?.kind === 'scope' && first.kind !== 'test' && first.kind !== 'investigation' ? path[1] : null
  return scope ? [first, scope] : [first]
}

function groupTests(tests: Test[], effective?: Record<string, number>): DrillGroup[] {
  const map = new Map<string, Test[]>()
  for (const t of tests) map.set(t.accession, [...(map.get(t.accession) ?? []), t])
  const accessions = new Set<string>(map.keys())
  if (effective) for (const [accession, value] of Object.entries(effective)) if (value >= 0.05) accessions.add(accession)
  const groups = [...accessions].map((accession) => {
    const list = map.get(accession) ?? []
    const group: DrillGroup = { accession, testIds: list.map((t) => t.id), count: list.length, assumed: list.filter(isAssumed).length }
    if (effective) group.effective = effective[accession] ?? 0
    return group
  })
  return groups.sort((a, b) =>
    effective ? (b.effective ?? 0) - (a.effective ?? 0) || byAccession(a.accession, b.accession) : b.count - a.count || byAccession(a.accession, b.accession),
  )
}

export function resolveDrill(path: DrillPath, data: DrillData, scenario: Scenario, m: MethodConstants = DEFAULT_METHOD): DrillResult {
  const first = path[0]
  const base = drillHead(path)
  // A mark drawn under a map filter counts only the tests of that filter.
  const filter = base[1]?.kind === 'scope' ? base[1] : null
  const scoped = filter ? { ...data, tests: data.tests.filter((t) => inScope(t, data.invByAcc[t.accession], filter)) } : data
  const mark = resolveMark(first, scoped, scenario, m)
  if (filter) mark.title = `${mark.title} Counted within the map filter: ${scopeLabel(filter, data.invByAcc, data.hardwareName)}.`
  const invStep = path.slice(1).find((s): s is Extract<DrillStep, { kind: 'investigation' }> => s.kind === 'investigation')
  const testStep = path.find((s): s is Extract<DrillStep, { kind: 'test' }> => s.kind === 'test')
  const crumbs: DrillResult['crumbs'] = []
  if (first.kind !== 'test') crumbs.push({ label: mark.label, path: base })
  const groups = groupTests(mark.tests, mark.effective)
  const edge = groupTests(mark.edge)
  const result: DrillResult = {
    level: 'mark',
    title: mark.title,
    formula: mark.formula,
    note: mark.note,
    groups,
    edge,
    testIds: mark.tests.map((t) => t.id),
    total: mark.tests.length,
    highlightTestId: mark.highlight,
    test: null,
    crumbs,
    links: mark.links ?? [],
  }
  let scope = [...mark.tests, ...mark.edge]
  let trail: DrillPath = base
  if (invStep && first.kind !== 'investigation' && first.kind !== 'test') {
    const name = data.invByAcc[invStep.accession]?.displayName ?? invStep.accession
    scope = scope.filter((t) => t.accession === invStep.accession)
    trail = [...base, invStep]
    crumbs.push({ label: name, path: trail })
    result.level = 'investigation'
    result.title = `${plural(scope.length, 'test')} of ${name} behind this mark.`
    result.testIds = scope.map((t) => t.id)
    result.total = scope.length
    result.note = scope.length === 0 ? 'None of this investigation\'s tests lie behind this mark.' : null
    result.links = []
  } else if (first.kind === 'investigation') {
    result.level = 'investigation'
  }
  if (testStep) {
    const test = data.testById.get(testStep.id) ?? null
    if (first.kind === 'test' && test) {
      const name = data.invByAcc[test.accession]?.displayName ?? test.accession
      crumbs.push({ label: name, path: [{ kind: 'investigation', accession: test.accession }] })
    }
    crumbs.push({ label: test ? `Test ${test.label}` : testStep.id, path: first.kind === 'test' ? base : [...trail, testStep] })
    result.level = 'test'
    result.test = test
    result.title = test ? `Test ${test.label} of ${data.invByAcc[test.accession]?.displayName ?? test.accession}` : 'This test is not in the current data.'
    result.note = test ? null : 'Nothing to show.'
    result.formula = null
    result.links = []
  }
  return result
}

// The count a chart prints for a mark. It is the same list the panel shows.
export function countBehind(step: DrillStep, data: DrillData, scenario: Scenario, m: MethodConstants = DEFAULT_METHOD): number {
  return resolveMark(step, data, scenario, m).tests.length
}
