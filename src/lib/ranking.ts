// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The relevance ranking. A transparent heuristic, shown with its four parts on every card.
import type { Investigation, MethodConstants, Pillar, Test } from '../types.ts'
import { DEFAULT_METHOD, distance, testWeight } from './coverage.ts'
import type { Point } from './coverage.ts'

export type RankParts = { A: number; F: number; P: number; D: number }

export type Ranked = {
  accession: string
  score: number
  parts: RankParts
  effectiveTests: number
  nearbyCount: number
  reason: string
}

export const RANK_WEIGHTS = { A: 0.45, F: 0.25, P: 0.2, D: 0.1 }

const FUEL_PART: Record<string, number> = { solid: 1.0, aerosol: 0.8, liquid: 0.6, gas: 0.4, unknown: 0.3 }
const FUEL_WORDS: Record<string, string> = {
  solid: 'solid materials',
  aerosol: 'smoke and aerosols',
  liquid: 'liquid fuels',
  gas: 'gas flames',
  unknown: 'fuel not classed',
}

export const isFlightInvestigation = (inv: Investigation): boolean => /microgravity/i.test(inv.projectType)

export function fuelPart(inv: Investigation): number {
  if (!isFlightInvestigation(inv)) return 0.3
  return FUEL_PART[inv.fuelClass] ?? 0.3
}

export function pillarPart(inv: Investigation, focus: Pillar | null): number {
  if (!focus) return 1
  return inv.pillar === focus || inv.secondaryPillars.includes(focus) ? 1 : 0.5
}

export const dataPart = (testCount: number): number => Math.min(1, Math.log10(1 + testCount) / Math.log10(501))

export function rankInvestigation(
  inv: Investigation,
  tests: Test[],
  point: Point,
  focus: Pillar | null,
  m: MethodConstants = DEFAULT_METHOD,
): Ranked {
  let n = 0
  let nearby = 0
  for (const test of tests) {
    n += testWeight(test, point, m)
    const d = distance(test, point, m)
    if (d != null && d <= 1) nearby += 1
  }
  const parts: RankParts = {
    A: tests.length === 0 ? 0 : 1 - Math.exp(-n / 5),
    F: fuelPart(inv),
    P: pillarPart(inv, focus),
    D: dataPart(inv.testCount),
  }
  const raw = 100 * (RANK_WEIGHTS.A * parts.A + RANK_WEIGHTS.F * parts.F + RANK_WEIGHTS.P * parts.P + RANK_WEIGHTS.D * parts.D)
  const score = Math.max(0, Math.min(100, raw))
  const range =
    tests.length === 0
      ? 'no test table in PSI'
      : `${nearby} ${nearby === 1 ? 'test' : 'tests'} within range of your atmosphere`
  const kind = isFlightInvestigation(inv) ? FUEL_WORDS[inv.fuelClass] : 'ground or modelling study'
  const reason = `${range}, ${kind}, ${inv.pillar === 'fundamentals' ? 'fundamentals' : `${inv.pillar} pillar`}`
  return { accession: inv.accession, score, parts, effectiveTests: n, nearbyCount: nearby, reason }
}

export function rankAll(
  investigations: Investigation[],
  testsByAccession: Record<string, Test[]>,
  point: Point,
  focus: Pillar | null,
  m: MethodConstants = DEFAULT_METHOD,
): Ranked[] {
  return investigations
    .map((inv) => rankInvestigation(inv, testsByAccession[inv.accession] || [], point, focus, m))
    .sort((a, b) => b.score - a.score || Number(a.accession.split('-')[1]) - Number(b.accession.split('-')[1]))
}

export const RANK_FORMULAS: Record<keyof RankParts, { label: string; formula: string }> = {
  A: { label: 'Atmosphere match', formula: 'A = 1 − exp(−N ÷ 5), where N is the sum of the proximity weights of its own tests. 0 if it has no table.' },
  F: { label: 'Fuel relevance', formula: 'F = 1.0 solid, 0.8 aerosol, 0.6 liquid, 0.4 gas, 0.3 ground or modelling study.' },
  P: { label: 'Pillar focus', formula: 'P = 1.0 if its pillar matches your focus pillar, 0.5 otherwise, 1.0 for all when no focus is set.' },
  D: { label: 'Amount of data', formula: 'D = min(1, log10(1 + tests) ÷ log10(501)).' },
}
