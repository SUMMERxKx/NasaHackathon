// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The final fixes of 15 November 2026: the reviewed assumptions, the flame gates, the chat question
// parser and its counts, the Lab tiles, the extinction ratio and the d-squared check.
import { describe, expect, it } from 'vitest'
import { validateDSquared } from './droplet.ts'
import { extinctionPoints, flexTests } from './lab.ts'
import { MAX_ROWS, buildEngine, parseQuestion, retrieve } from './retrieve.ts'
import type { RetrieveContext } from './retrieve.ts'
import { GATES } from '../three/flameParams.ts'
import { data, preset, searchIndex, snapshot } from './testData.ts'

const ctx = (): RetrieveContext => ({ scenario: preset('iss'), investigations: snapshot.investigations, tests: snapshot.tests, habitats: snapshot.habitats })
const engine = buildEngine(searchIndex)

describe('the chat question parser', () => {
  it('reads a percentage as oxygen only when oxygen or O2 is beside it', () => {
    expect(parseQuestion('How was 20% carbon dioxide used?', ctx()).o2).toBeNull()
    expect(parseQuestion('What happens to a 50% heptane mix?', ctx()).o2).toBeNull()
    expect(parseQuestion('Which tests used 21% oxygen?', ctx()).o2).toBe(0.21)
    expect(parseQuestion('What do we know about fire at 34 percent oxygen?', ctx()).o2).toBe(0.34)
    expect(parseQuestion('Tests with oxygen at 30%', ctx()).o2).toBe(0.3)
    expect(parseQuestion('Burning in 26.5% O2', ctx()).o2).toBe(0.265)
  })
  it('leaves the habitat alone for a carbon dioxide or fuel mix question', () => {
    expect(retrieve('How was 20% carbon dioxide used?', engine, ctx()).scenarioChange).toBeNull()
    expect(retrieve('What happens to a 50% heptane mix?', engine, ctx()).scenarioChange).toBeNull()
  })
  it('counts every matching test before the list is cut', () => {
    const rows = retrieve('Which tests used 21% oxygen?', engine, ctx()).rows
    const truth = data.tests.filter((t) => t.o2 != null && Math.abs(t.o2 - 0.21) <= 0.015 + 1e-9).length
    expect(rows?.total).toBe(truth)
    expect(rows?.total).toBeGreaterThan(MAX_ROWS)
    expect(rows?.testIds.length).toBe(MAX_ROWS)
  })
  it('lists no rows and keeps the habitat when the named investigation has no match', () => {
    const result = retrieve('Which BASS tests used 85% oxygen?', engine, ctx())
    expect(result.rows?.total).toBe(0)
    expect(result.rows?.testIds).toEqual([])
    expect(result.rows?.filter).toContain("None of BASS's tests match")
    expect(result.scenarioChange).toBeNull()
  })
  it('keeps only the named investigation when it has matches', () => {
    const rows = retrieve('Which BASS-II tests used 21% oxygen?', engine, ctx()).rows
    expect(rows?.total).toBeGreaterThan(0)
    for (const id of rows?.testIds ?? []) expect(id.startsWith('PSI-25:')).toBe(true)
  })
})

describe('the reviewed assumptions', () => {
  const byAcc = (a: string) => snapshot.assumptions.find((x) => x.accession === a)
  it('has no entry left at needs human check, and carries the review note', () => {
    for (const a of snapshot.assumptions) expect(['confirmed', 'changed']).toContain(a.status)
    expect(snapshot.assumptionsReview).toContain('Reviewed by the EMBER team on 15 November 2026')
    expect(snapshot.assumptionsReview).toContain('A combustion researcher should confirm before this is used for design.')
  })
  it('takes ACME BRE and DAFT off the map and puts Saffire-III on it', () => {
    expect(byAcc('PSI-20')?.pressureAtm).toBeNull()
    expect(byAcc('PSI-20')?.reason).toContain('"The chamber pressures were also varied but are not identified in this summary table."')
    expect(byAcc('PSI-47')?.o2).toBeNull()
    expect(byAcc('PSI-100')?.o2).toBe(0.212)
    for (const t of data.tests.filter((x) => x.accession === 'PSI-20')) expect(t.pressureAtm).toBeNull()
    for (const t of data.tests.filter((x) => x.accession === 'PSI-47')) expect(t.o2).toBeNull()
    for (const t of data.tests.filter((x) => x.accession === 'PSI-100')) expect([t.o2, t.o2Source]).toEqual([0.212, 'assumed'])
    expect(snapshot.counts.testsWithAssumedValue).toBe(886)
    expect(snapshot.counts.testsWithAssumedOxygen).toBe(721)
  })
  it('drops the two rows that record no test, and lists them', () => {
    expect(snapshot.droppedRows.map((d) => d.accession).sort()).toEqual(['PSI-20', 'PSI-26'])
    expect(data.tests.some((t) => t.accession === 'PSI-26' && /soot cleaning/i.test(t.fuel ?? ''))).toBe(false)
    expect(data.tests.some((t) => t.accession === 'PSI-20' && t.label === '2019 April 1')).toBe(false)
    expect(snapshot.counts.rows).toBe(2009)
  })
  it('records helium as the other gas on the ACME s-Flame helium days', () => {
    const helium = data.tests.filter((t) => t.accession === 'PSI-23' && (t.diluent?.he ?? 0) > 0)
    expect(helium.length).toBe(14)
    for (const t of helium) expect(t.raw['Atmosphere*'] ?? t.raw.Atmosphere ?? '').toMatch(/He/)
  })
})

describe('the flame gates and the Lab tiles', () => {
  it('has both gates on', () => {
    expect(GATES).toEqual({ tadConfirmed: true, burningRateUnitConfirmed: true })
  })
})

describe('the extinction ratio and the d-squared check', () => {
  it('plots only tests that ended in extinction', () => {
    for (const fuel of ['Methanol', 'Heptane']) {
      for (const p of extinctionPoints(data.tests, fuel)) expect(data.testById.get(p.testId)?.outcome).toBe('Extinction')
    }
  })
  it('reads the I5 ratio over extinction rows only', () => {
    const i5 = data.insightById.I5.numbers
    expect([i5.medianRatioLow, i5.ratioTestsLow, i5.medianRatioHigh, i5.ratioTestsHigh]).toEqual([0.82, 22, 0.41, 2])
  })
  it('leaves out the test whose extinction diameter is not below its start diameter', () => {
    const v = validateDSquared(flexTests(data.tests))
    expect(v.points.length).toBe(195)
    expect(v.points.some((p) => data.testById.get(p.testId)?.label === 'C13H102')).toBe(false)
    expect(v.points.every((p) => p.predicted > 0)).toBe(true)
    expect(data.insightById.I4.numbers).toMatchObject({ tests: 195, medianRatio: 0.951, q1: 0.919, q3: 0.975 })
  })
})
