// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Evidence Coverage score. It weights every flight test by how close it is to a habitat. It is not a safety rating.
import type { CoverageResult, Investigation, MethodConstants, Pillar, Test } from '../types.ts'
import { psiToAtm } from './units.ts'

export const PILLARS: Pillar[] = ['prevention', 'detection', 'suppression']

// These constants are design choices by the team. The Methods screen says so.
export const DEFAULT_METHOD: MethodConstants = {
  o2Scale: 0.04,
  pressureScale: 0.25,
  saturation: 10,
  fundamentalsWeight: 0.3,
  pillarWeights: { prevention: 0.4, detection: 0.3, suppression: 0.3 },
}

export type Point = { o2: number; pressureAtm: number }

export const scenarioPoint = (s: { o2: number; pressurePsi: number }): Point => ({
  o2: s.o2,
  pressureAtm: psiToAtm(s.pressurePsi),
})

// Distance in coverage units. 4 points of oxygen is one unit. About 25 percent in pressure is one unit.
export function distance(test: Test, point: Point, m: MethodConstants = DEFAULT_METHOD): number | null {
  if (test.o2 == null || test.pressureAtm == null || test.pressureAtm <= 0) return null
  const dx = (test.o2 - point.o2) / m.o2Scale
  const dp = (Math.log(test.pressureAtm) - Math.log(point.pressureAtm)) / m.pressureScale
  return Math.sqrt(dx * dx + dp * dp)
}

export const isAssumed = (test: Test): boolean => test.o2Source === 'assumed' || test.pressureSource === 'assumed'

// w_i = a_i * exp(-0.5 * d^2). a_i is 1 when both values come from the table and 0.5 otherwise.
export function testWeight(test: Test, point: Point, m: MethodConstants = DEFAULT_METHOD): number {
  const d = distance(test, point, m)
  if (d == null) return 0
  return (isAssumed(test) ? 0.5 : 1) * Math.exp(-0.5 * d * d)
}

export type PillarLookup = Record<string, { pillar: Investigation['pillar']; secondaryPillars: Pillar[] }>

export function pillarLookup(investigations: Investigation[]): PillarLookup {
  const out: PillarLookup = {}
  for (const inv of investigations) out[inv.accession] = { pillar: inv.pillar, secondaryPillars: inv.secondaryPillars }
  return out
}

// How much one investigation's tests count toward a pillar.
// Primary pillar: 1. Fundamentals and secondary pillars: the fundamentals weight.
export function pillarFactor(
  entry: { pillar: Investigation['pillar']; secondaryPillars: Pillar[] } | undefined,
  pillar: Pillar,
  m: MethodConstants = DEFAULT_METHOD,
): number {
  if (!entry) return 0
  if (entry.pillar === pillar) return 1
  if (entry.pillar === 'fundamentals' || entry.secondaryPillars.includes(pillar)) return m.fundamentalsWeight
  return 0
}

export const scoreFromEffective = (n: number, m: MethodConstants = DEFAULT_METHOD): number =>
  100 * (1 - Math.exp(-n / m.saturation))

export function computeCoverage(
  tests: Test[],
  lookup: PillarLookup,
  point: Point,
  m: MethodConstants = DEFAULT_METHOD,
): CoverageResult {
  const effective: Record<Pillar, number> = { prevention: 0, detection: 0, suppression: 0 }
  const assumed: Record<Pillar, number> = { prevention: 0, detection: 0, suppression: 0 }
  const nearbyByFuelClass: Record<string, number> = {}
  const near: { testId: string; distance: number }[] = []
  let nearbyTotal = 0
  for (const test of tests) {
    const d = distance(test, point, m)
    if (d == null) continue
    const w = (isAssumed(test) ? 0.5 : 1) * Math.exp(-0.5 * d * d)
    const entry = lookup[test.accession]
    for (const pillar of PILLARS) {
      const f = pillarFactor(entry, pillar, m)
      if (f === 0) continue
      effective[pillar] += f * w
      if (isAssumed(test)) assumed[pillar] += f * w
    }
    if (d <= 1) {
      nearbyTotal += 1
      nearbyByFuelClass[test.fuelClass] = (nearbyByFuelClass[test.fuelClass] || 0) + 1
    }
    near.push({ testId: test.id, distance: d })
  }
  near.sort((a, b) => a.distance - b.distance || (a.testId < b.testId ? -1 : 1))
  const byPillar = {} as CoverageResult['byPillar']
  let overall = 0
  let weightedAssumed = 0
  let weightedTotal = 0
  for (const pillar of PILLARS) {
    const score = scoreFromEffective(effective[pillar], m)
    byPillar[pillar] = {
      score,
      effectiveTests: effective[pillar],
      assumedShare: effective[pillar] > 0 ? assumed[pillar] / effective[pillar] : 0,
    }
    overall += m.pillarWeights[pillar] * score
    weightedAssumed += m.pillarWeights[pillar] * score * byPillar[pillar].assumedShare
    weightedTotal += m.pillarWeights[pillar] * score
  }
  return {
    overall,
    byPillar,
    assumedShare: weightedTotal > 0 ? weightedAssumed / weightedTotal : 0,
    nearbyByFuelClass,
    nearbyTotal,
    nearest: near.slice(0, 5),
  }
}

// The overall score at any point of the map. The coverage field and the dial both use this.
export function overallAt(tests: Test[], lookup: PillarLookup, point: Point, m: MethodConstants = DEFAULT_METHOD): number {
  return computeCoverage(tests, lookup, point, m).overall
}

export const COVERAGE_FORMULA =
  'w = a × exp(−0.5 × (dx² + dp²)), dx = Δoxygen ÷ 0.04, dp = Δln(pressure) ÷ 0.25, a = 1 from the table or 0.5 if assumed. coverage = 100 × (1 − exp(−N ÷ 10)), where N is the sum of w.'
