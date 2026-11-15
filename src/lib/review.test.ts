// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Search matching, the CSV of a filtered view, the note on tests that are not plotted and the
// thickness kept as NASA wrote it.
import { describe, expect, it } from 'vitest'
import type { DrillStep, Test } from '../types.ts'
import { CSV_COLUMNS, testsToCsv, viewCsvName } from './csv.ts'
import { ambiguousThickness, burnLengthPairs } from './lab.ts'
import { plottable, unplottedNote, unplottedReason } from './mapLayout.ts'
import { investigationSearchText, matchesTerms, searchTerms, testSearchText } from './search.ts'
import { decodeDrill, encodeDrill, resolveDrill } from './drill.ts'
import { makeScope, scopeFromParams, scopeLabel, scopeStep, scopeTests } from './mapScope.ts'
import { moonCounts } from './regions.ts'
import { data, preset, snapshot } from './testData.ts'

const makeTest = (over: Partial<Test>): Test => ({
  id: 'X:0:1', accession: 'X', table: 't', rowIndex: 1, label: '1', fuel: 'PMMA', fuelClass: 'solid',
  o2: 0.21, o2Source: 'table', pressureAtm: 1, pressureSource: 'table', flowCmS: null, diluent: null,
  outcome: null, extra: {}, raw: {}, ...over,
})

const findInvestigations = (query: string) =>
  snapshot.investigations.filter((inv) => matchesTerms(investigationSearchText(inv, data.testsByAcc[inv.accession] ?? []), searchTerms(query))).map((inv) => inv.displayName)
const findTests = (query: string) => data.tests.filter((t) => matchesTerms(testSearchText(t, data.invByAcc[t.accession].displayName), searchTerms(query)))

describe('search', () => {
  it('splits a query into lowercase words and treats a blank query as no filter', () => {
    expect(searchTerms('  Saffire   Silicone ')).toEqual(['saffire', 'silicone'])
    expect(searchTerms('   ')).toEqual([])
    expect(matchesTerms('anything', [])).toBe(true)
  })
  it('matches without regard to case and needs every word, in any order', () => {
    expect(matchesTerms('Saffire-II • Silicone', searchTerms('silicone SAFFIRE'))).toBe(true)
    expect(matchesTerms('Saffire-II • Silicone', searchTerms('saffire pmma'))).toBe(false)
  })
  it('finds investigations by name, by identifier and by the fuels their tables list', () => {
    expect(findInvestigations('Saffire')).toEqual(['Saffire-I', 'Saffire-II', 'Saffire-III'])
    expect(findInvestigations('heptane').sort()).toEqual(['FLEX', 'FLEX-2'])
    expect(findInvestigations('psi-69')).toEqual(['FLEX'])
    expect(findInvestigations('saffire silicone')).toEqual(['Saffire-II'])
    expect(findInvestigations('no such words here')).toEqual([])
  })
  it('finds tests by label, investigation and fuel', () => {
    expect(findTests('c11m201').map((t) => t.id)).toEqual(['PSI-69:0:114'])
    const heptane = findTests('heptane')
    expect(heptane.length).toBeGreaterThan(0)
    expect(heptane.every((t) => /heptane/i.test(t.fuel ?? ''))).toBe(true)
    expect(findTests('BASS-II').every((t) => t.accession === 'PSI-25')).toBe(true)
  })
})

describe('CSV of a filtered view', () => {
  it('names the filter in the file name', () => {
    expect(viewCsvName(['BASS-II'])).toBe('ember-BASS-II-tests.csv')
    expect(viewCsvName(['FLEX', 'liquid', 'n-heptane droplet'])).toBe('ember-FLEX-liquid-n-heptane-droplet-tests.csv')
    expect(viewCsvName(['', null, undefined])).toBe('ember-plotted-tests.csv')
    expect(viewCsvName(['a'.repeat(200)]).length).toBeLessThan(110)
  })
  it('writes exactly the rows in view, with the coordinate source columns and quoting', () => {
    const view = [
      makeTest({ id: 'A:0:1', accession: 'A', label: 'one, "quoted"', o2Source: 'assumed', pressureSource: 'assumed' }),
      makeTest({ id: 'A:0:2', accession: 'A', label: 'two', pressureAtm: null, pressureSource: null }),
    ]
    const lines = testsToCsv(view, { A: 'Alpha' }).trimEnd().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(CSV_COLUMNS.join(','))
    expect(lines[1]).toContain('"one, ""quoted"""')
    const header = lines[0].split(',')
    const second = lines[2].split(',')
    expect(second[header.indexOf('o2_source')]).toBe('table')
    expect(second[header.indexOf('pressure_atm')]).toBe('')
    expect(lines[1].split(',').includes('assumed')).toBe(true)
  })
  it('exports the BASS-II view of the real data with BASS-II rows only', () => {
    const view = data.tests.filter(plottable).filter((t) => t.accession === 'PSI-25')
    const csv = testsToCsv(view, Object.fromEntries(snapshot.investigations.map((i) => [i.accession, i.displayName])))
    const rows = csv.trimEnd().split('\n').slice(1)
    expect(rows).toHaveLength(view.length)
    expect(rows.every((r) => r.startsWith('PSI-25:'))).toBe(true)
  })
})

describe('tests that are not on the map', () => {
  it('names FLEX C11M201 and its zero pressure when CFI-G and FLEX are compared', () => {
    const tests = [...(data.testsByAcc['PSI-159'] ?? []), ...(data.testsByAcc['PSI-69'] ?? [])]
    const note = unplottedNote(tests)
    expect(note.total).toBe(607)
    expect(note.plotted).toBe(606)
    expect(note.more).toBe(0)
    expect(note.named.map((n) => n.test.label)).toEqual(['C11M201'])
    expect(note.named[0].reason).toBe("has a pressure of 0 in NASA's table, so it cannot be placed on the pressure axis")
  })
  it('gives no note when every test is plotted', () => {
    expect(unplottedNote([makeTest({})]).named).toEqual([])
    expect(unplottedReason(makeTest({}))).toBeNull()
  })
  it('reads the reason from the row as NASA wrote it', () => {
    expect(unplottedReason(makeTest({ o2: null, raw: { XO2: 'RAMP' } }))).toBe(`has oxygen written as "RAMP" in NASA's table, not as a single value`)
    expect(unplottedReason(makeTest({ o2: null, pressureAtm: null }))).toBe("has no oxygen or pressure value in NASA's table")
  })
  it('names at most five and counts the rest', () => {
    const many = Array.from({ length: 8 }, (_, i) => makeTest({ id: `X:0:${i}`, o2: null }))
    const note = unplottedNote(many)
    expect(note.named).toHaveLength(5)
    expect(note.more).toBe(3)
    expect(note.plotted).toBe(0)
  })
})

describe('thickness kept as written', () => {
  it('flags a leading zero with no decimal point and nothing else', () => {
    expect(ambiguousThickness('037 mm')).toBe('0.37 mm')
    expect(ambiguousThickness('0.37 mm')).toBeNull()
    expect(ambiguousThickness('1 cm')).toBeNull()
    expect(ambiguousThickness('0.85 and 0.37 mm')).toBeNull()
  })
  it('keeps the raw text for Saffire-II samples 2-4, 2-5 and 2-6', () => {
    const flagged = burnLengthPairs(data.tests).filter((p) => p.thicknessLikely)
    expect(flagged.map((p) => p.label)).toEqual(['2-4', '2-5', '2-6'])
    expect(flagged.every((p) => p.thickness === '037 mm')).toBe(true)
  })
})

describe('search inside the map filter scope', () => {
  const plotted = data.tests.filter(plottable)
  it('reads the search from the dashboard address and narrows the same set as the filters', () => {
    const scope = scopeFromParams(new URLSearchParams('inv=PSI-69&q=  Heptane  '))
    expect(scope).toEqual({ inv: 'PSI-69', q: 'Heptane' })
    const view = scopeTests(plotted, data.invByAcc, scope)
    expect(view.length).toBeGreaterThan(0)
    expect(view.every((t) => t.accession === 'PSI-69' && /heptane/i.test(t.fuel ?? ''))).toBe(true)
    expect(view.length).toBeLessThan(scopeTests(plotted, data.invByAcc, makeScope({ inv: 'PSI-69' })).length)
    expect(scopeLabel(scope, data.invByAcc)).toBe('FLEX, matching "Heptane"')
    expect(viewCsvName([scopeLabel(scope, data.invByAcc)])).toBe('ember-FLEX-matching-Heptane-tests.csv')
    expect(makeScope({ q: '   ' })).toEqual({})
  })
  it('gives the Moon Base drill the same tests as the searched view', () => {
    const scope = makeScope({ q: 'heptane' })
    const view = scopeTests(data.tests, data.invByAcc, scope)
    const result = resolveDrill([{ kind: 'region', id: 'moon' }, scopeStep(scope) as DrillStep], data, preset('iss'))
    expect(result.total).toBe(moonCounts(view).total)
    expect(result.title).toContain('matching "heptane"')
  })
  it('writes the search into the drill address and reads it back', () => {
    const path: DrillStep[] = [{ kind: 'region', id: 'moon' }, scopeStep(makeScope({ inv: 'PSI-69', q: 'n-heptane, 50%' })) as DrillStep]
    const text = encodeDrill(path)
    expect(text).toBe('region.moon~scope.,,PSI-69,,q=n-heptane%2C%2050%25')
    expect(decodeDrill(text)).toEqual(path)
    expect(decodeDrill('region.moon~scope.,,,,q=silicone')).toEqual([{ kind: 'region', id: 'moon' }, { kind: 'scope', q: 'silicone' }])
    for (const bad of ['region.moon~scope.,,,,x', 'region.moon~scope.,,,,q=', 'region.moon~scope.,,,,q=%20']) expect(decodeDrill(bad)).toBeNull()
  })
  it('exports the searched view as exactly its rows', () => {
    const view = scopeTests(plotted, data.invByAcc, makeScope({ q: 'saffire' }))
    const rows = testsToCsv(view, Object.fromEntries(snapshot.investigations.map((i) => [i.accession, i.displayName]))).trimEnd().split('\n').slice(1)
    expect(rows.map((r) => r.split(',')[0]).sort()).toEqual(view.map((t) => t.id).sort())
  })
})
