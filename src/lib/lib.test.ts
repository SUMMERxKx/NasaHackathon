// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { describe, expect, it } from 'vitest'
import type { Investigation, Test } from '../types.ts'
import { cleanFuel, findHeader, parseBreOxygenList, parseNumber, parseOxygenPercents } from './parse.ts'
import { atmToPsi, barToAtm, mmHgToAtm, ppO2, psiToAtm } from './units.ts'
import { computeCoverage, DEFAULT_METHOD } from './coverage.ts'
import { rankInvestigation } from './ranking.ts'
import { burnTimeToExtinction, diameterAt } from './droplet.ts'
import { median, quantile } from './stats.ts'

const makeTest = (over: Partial<Test>): Test => ({
  id: 'X:0:1', accession: 'X', table: 't', rowIndex: 1, label: '1', fuel: 'PMMA', fuelClass: 'solid',
  o2: 0.21, o2Source: 'table', pressureAtm: 1, pressureSource: 'table', flowCmS: null, diluent: null,
  outcome: null, extra: {}, raw: {}, ...over,
})

describe('units', () => {
  it('converts pressures', () => {
    expect(psiToAtm(14.696)).toBeCloseTo(1, 9)
    expect(mmHgToAtm(760)).toBeCloseTo(1, 9)
    expect(barToAtm(1)).toBeCloseTo(0.98692, 9)
    expect(atmToPsi(1)).toBeCloseTo(14.696, 9)
  })
  it('gives the oxygen partial pressure for 34% at 8.2 psi', () => {
    expect(ppO2(0.34, 8.2)).toBeCloseTo(2.79, 2)
  })
})

describe('parse', () => {
  it('reads plain, approximate and ranged numbers', () => {
    expect(parseNumber('21.5').value).toBe(21.5)
    expect(parseNumber('~ 21.5')).toMatchObject({ value: 21.5, approximate: true })
    expect(parseNumber('21.5 - 21.7')).toMatchObject({ value: 21.5, isRange: true })
    expect(parseNumber('22.1 to 22.0')).toMatchObject({ value: 22.1, isRange: true })
  })
  it('reads units', () => {
    expect(parseNumber('20 cm/s')).toMatchObject({ value: 20, unit: 'cm/s' })
    expect(parseNumber('0.27 mm')).toMatchObject({ value: 0.27, unit: 'mm' })
    expect(parseNumber('1 atm')).toMatchObject({ value: 1, unit: 'atm' })
    expect(parseNumber('.33 cm').value).toBe(0.33)
  })
  it('gives null for words and notes', () => {
    for (const cell of ['RAMPED', 'RAMP', 'LOW O2', 'none', 'n/a', 'See Fig. 5', '', '   ']) {
      expect(parseNumber(cell).value).toBeNull()
    }
  })
  it('does not read dates and times as numbers', () => {
    for (const cell of ['2/19/2014', '14:37:08', '9-Mar-17', '2012-FEB-09']) expect(parseNumber(cell).value).toBeNull()
  })
  it('never throws', () => {
    expect(parseNumber(null).value).toBeNull()
    expect(parseNumber(undefined).value).toBeNull()
  })
  it('fixes the BRE oxygen typos only in that column', () => {
    expect(parseBreOxygenList('3400%')).toEqual([{ value: 34, typoFixed: true }])
    expect(parseBreOxygenList('21; 26.5; 40')).toEqual([
      { value: 21, typoFixed: false },
      { value: 26.5, typoFixed: false },
      { value: 40, typoFixed: false },
    ])
    expect(parseNumber('3400%').value).toBe(3400)
  })
  it('reads oxygen percents from atmosphere text', () => {
    expect(parseOxygenPercents('~21% O2 with N2')).toEqual([21])
    expect(parseOxygenPercents('~30% and ~21% O2 with He')).toEqual([30, 21])
  })
  it('cleans fuel names', () => {
    expect(cleanFuel('75 % Propylene')).toBe(cleanFuel('75% Propylene'))
    expect(cleanFuel('  ')).toBeNull()
  })
  it('matches headers loosely', () => {
    expect(findHeader(['Sample #', 'Sample Material  '], 'sample material')).toBe('Sample Material  ')
  })
})

describe('coverage', () => {
  const lookup = { X: { pillar: 'prevention' as const, secondaryPillars: [] } }
  const point = { o2: 0.21, pressureAtm: 1 }
  it('gives prevention coverage above 94 on 30 identical table tests', () => {
    const tests = Array.from({ length: 30 }, (_, i) => makeTest({ id: `X:0:${i}` }))
    expect(computeCoverage(tests, lookup, point).byPillar.prevention.score).toBeGreaterThan(94)
  })
  it('gives coverage below 1 far from all tests', () => {
    const tests = Array.from({ length: 30 }, (_, i) => makeTest({ id: `X:0:${i}` }))
    expect(computeCoverage(tests, lookup, { o2: 0.9, pressureAtm: 0.3 }).overall).toBeLessThan(1)
  })
  it('counts assumed tests at half weight', () => {
    const table = computeCoverage([makeTest({})], lookup, point).byPillar.prevention.effectiveTests
    const assumed = computeCoverage([makeTest({ pressureSource: 'assumed' })], lookup, point).byPillar.prevention
    expect(assumed.effectiveTests).toBeCloseTo(table / 2, 9)
    expect(assumed.assumedShare).toBe(1)
  })
  it('uses the stated constants', () => {
    expect(DEFAULT_METHOD).toMatchObject({ o2Scale: 0.04, pressureScale: 0.25, saturation: 10, fundamentalsWeight: 0.3 })
  })
})

describe('ranking', () => {
  const inv = { accession: 'X', pillar: 'prevention', secondaryPillars: [], fuelClass: 'solid', projectType: 'Microgravity Investigation', testCount: 0 } as unknown as Investigation
  it('keeps scores between 0 and 100 and gives A = 0 with no table', () => {
    const ranked = rankInvestigation(inv, [], { o2: 0.21, pressureAtm: 1 }, null)
    expect(ranked.parts.A).toBe(0)
    expect(ranked.score).toBeGreaterThanOrEqual(0)
    expect(ranked.score).toBeLessThanOrEqual(100)
    const many = Array.from({ length: 600 }, (_, i) => makeTest({ id: `X:0:${i}` }))
    const full = rankInvestigation({ ...inv, testCount: 600 }, many, { o2: 0.21, pressureAtm: 1 }, 'prevention')
    expect(full.score).toBeLessThanOrEqual(100)
    expect(full.score).toBeGreaterThan(99)
  })
})

describe('droplet', () => {
  it('gives a burn time of 6 seconds for d0 2, dExt 1, K 0.5', () => {
    expect(burnTimeToExtinction(2, 1, 0.5)).toBe(6)
  })
  it('never gives a negative diameter', () => {
    expect(diameterAt(2, 0.5, 100)).toBe(0)
  })
})

describe('stats', () => {
  it('finds medians and quartiles', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 9)
    expect(median([])).toBeNull()
  })
})
