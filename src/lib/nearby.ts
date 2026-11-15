// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The nearby evidence summary: the five counts that lead the dashboard, the caveat counts beside
// them and the one gap statement. The drill panel finds its rows through the same filter, so a
// count and the rows behind it cannot differ.
import type { DrillStep, FuelClass, MethodConstants, NearbySubset, Test } from '../types.ts'
import { DEFAULT_METHOD, distance, isAssumed } from './coverage.ts'
import type { Point } from './coverage.ts'

// The four rows of the count chart, in reading order. No class is dropped when it is empty,
// because the empty classes are the story.
export const NEARBY_FUELS: FuelClass[] = ['solid', 'liquid', 'gas', 'aerosol']
export const FUEL_FILTERS: FuelClass[] = [...NEARBY_FUELS, 'unknown']
export const NEARBY_SUBSETS: NearbySubset[] = ['assumed', 'inverse']

export const FUEL_LABEL: Record<FuelClass, string> = {
  solid: 'Solid materials',
  liquid: 'Liquid fuels',
  gas: 'Gas flames',
  aerosol: 'Smoke and aerosols',
  unknown: 'Not classed',
}

// The class as it reads before the word test.
export const FUEL_WORD: Record<FuelClass, string> = {
  solid: 'solid-material',
  liquid: 'liquid-fuel',
  gas: 'gas-flame',
  aerosol: 'smoke',
  unknown: 'unclassed',
}

export const NEARBY_RULE =
  'Nearby means within one unit of distance from the chosen oxygen and pressure. One unit is 4 points of oxygen or about 25 percent in pressure. Gravity is not part of the rule.'
export const NOT_PROOF = 'A nearby row is not a test of this habitat and not proof of safety.'
export const NO_PARTIAL_GRAVITY = 'No partial-gravity data in this snapshot.'
export const NO_NEARBY = 'No nearby rows'

// An inverse flame burns a jet of oxidizer inside fuel. Its oxygen value is the oxidizer stream,
// not a cabin atmosphere.
export const isInverseFlame = (test: Test): boolean => test.flags?.includes('oxidizer-stream') ?? false

export type NearbyFilter = { fuel?: FuelClass; only?: NearbySubset }

// The one definition of nearby: a distance of at most one unit. Assumed coordinates count,
// exactly as they do in the coverage result.
export function nearbyTests(tests: Test[], point: Point, filter: NearbyFilter = {}, m: MethodConstants = DEFAULT_METHOD): Test[] {
  return tests.filter((test) => {
    const d = distance(test, point, m)
    if (d == null || d > 1) return false
    if (filter.fuel && test.fuelClass !== filter.fuel) return false
    if (filter.only === 'assumed' && !isAssumed(test)) return false
    if (filter.only === 'inverse' && !isInverseFlame(test)) return false
    return true
  })
}

export type NearbySummary = {
  total: number
  byFuel: Record<FuelClass, number>
  assumed: number
  inverse: number
  investigations: number
}

export function summarizeNearby(tests: Test[], point: Point, m: MethodConstants = DEFAULT_METHOD): NearbySummary {
  const near = nearbyTests(tests, point, {}, m)
  const byFuel: Record<FuelClass, number> = { solid: 0, liquid: 0, gas: 0, aerosol: 0, unknown: 0 }
  for (const test of near) byFuel[test.fuelClass] += 1
  return {
    total: near.length,
    byFuel,
    assumed: near.filter(isAssumed).length,
    inverse: near.filter(isInverseFlame).length,
    investigations: new Set(near.map((test) => test.accession)).size,
  }
}

const whole = (n: number): string => n.toLocaleString('en-US')

export type NearbyStep = Extract<DrillStep, { kind: 'near' }>
export type NearbyRow = { fuel: FuelClass; label: string; count: number; step: NearbyStep; describe: string }

// The rows of the count chart: one for each fuel class, each with the drill step that opens
// exactly its rows and the words a screen reader hears. A class with no rows keeps its row.
export function nearbyRows(summary: NearbySummary, point: Point): NearbyRow[] {
  const fuels = summary.byFuel.unknown > 0 ? FUEL_FILTERS : NEARBY_FUELS
  return fuels.map((fuel) => {
    const count = summary.byFuel[fuel]
    const describe =
      count === 0
        ? `${FUEL_LABEL[fuel]}: ${NO_NEARBY.toLowerCase()}. Press Enter to see why.`
        : `${FUEL_LABEL[fuel]}: ${whole(count)} nearby test ${count === 1 ? 'record' : 'records'}. Press Enter for the ${count === 1 ? 'row' : 'rows'}.`
    return { fuel, label: FUEL_LABEL[fuel], count, step: { kind: 'near', o2: point.o2, pressureAtm: point.pressureAtm, fuel }, describe }
  })
}

// The whole chart in one sentence, for its accessible name.
export function nearbyDescription(summary: NearbySummary, point: Point, name: string): string {
  const parts = nearbyRows(summary, point).map((row) => `${row.label}: ${row.count === 0 ? NO_NEARBY.toLowerCase() : whole(row.count)}`)
  return `${whole(summary.total)} NASA test ${summary.total === 1 ? 'record' : 'records'} near ${name}. ${parts.join('. ')}.`
}

const orList = (words: string[]): string => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`)

// One plain statement of what is near the habitat and what is missing. Each sentence is built
// from the counts, so a custom habitat gets an honest line too.
export function gapStatement(summary: NearbySummary, partialGravity: boolean): string[] {
  const out: string[] = []
  const present = NEARBY_FUELS.filter((fuel) => summary.byFuel[fuel] > 0)
  const missing = NEARBY_FUELS.filter((fuel) => summary.byFuel[fuel] === 0)
  if (summary.total === 0) {
    out.push('No test records meet the nearby oxygen-pressure rule.')
    out.push('This is an evidence gap, not proof of safety or danger.')
  } else if (missing.length === 0) {
    out.push('Nearby evidence spans all four fuel classes.')
  } else if (present.length === 1) {
    out.push(`Nearby evidence is limited to ${FUEL_WORD[present[0]]} tests.`)
  } else {
    out.push(`No nearby ${orList(missing.map((fuel) => FUEL_WORD[fuel]))} tests.`)
  }
  if (summary.total > 0 && summary.assumed * 2 >= summary.total) out.push('Most of these rows use assumed coordinates.')
  if (partialGravity) out.push(NO_PARTIAL_GRAVITY)
  return out
}

// What a ranked investigation adds near this habitat, in a few words. An investigation with no
// nearby row is background evidence and is named as such.
export function nearbyReason(nearbyCount: number, testCount: number, fuel: FuelClass, flight: boolean): string {
  const kind = flight ? FUEL_LABEL[fuel] : 'Ground or modelling study'
  if (nearbyCount > 0) return `${kind}. ${nearbyCount} of its ${testCount} ${testCount === 1 ? 'test' : 'tests'} ${nearbyCount === 1 ? 'is' : 'are'} nearby.`
  if (testCount === 0) return `${kind}. Background evidence. It has no test table in PSI.`
  return `${kind}. Background evidence. None of its ${testCount} ${testCount === 1 ? 'test is' : 'tests are'} nearby.`
}
