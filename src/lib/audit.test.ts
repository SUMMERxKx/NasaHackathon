// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The fixes from the user and data audit: inverse flames in the Moon Base counts, the Compare map
// scope, the BRE pressure note, the Lab model end, the stale chunk reload and the glossary.
import { describe, expect, it, vi } from 'vitest'
import type { DrillStep } from '../types.ts'
import { CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW_MS, isChunkError, reloadOnceForChunk, withChunkReload } from './chunkReload.ts'
import { decodeDrill, encodeDrill, resolveDrill } from './drill.ts'
import { burnTimeToExtinction, dropletValues, modelEndTime } from './droplet.ts'
import { compareScope, makeScope, scopeLabel, scopeStep, scopeTests } from './mapScope.ts'
import { BRE_ACCESSION, breGapNote } from './nearby.ts'
import { inverseClause, moonCounts } from './regions.ts'
import { data, preset, snapshot } from './testData.ts'

const memory = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map }
}
const staleChunk = new TypeError('Failed to fetch dynamically imported module: https://ember.example/assets/Compare-old.js')

describe('inverse flames in the Moon Base counts', () => {
  it('says how many of the 66 gas tests are inverse flames, from the data', () => {
    const counts = moonCounts(data.tests)
    expect(counts).toMatchObject({ gas: 66, inverse: 46 })
    expect(data.insightById.I2.numbers.moonRegionInverse).toBe(counts.inverse)
    expect(data.insightById.I2.headline).toContain('46 of them inverse flames whose oxygen is the burner stream, not the chamber')
  })
  it('counts inverse flames within a scope, so a filter changes the badge', () => {
    const flameDesign = moonCounts(scopeTests(data.tests, data.invByAcc, makeScope({ inv: 'PSI-10' })))
    const cfig = moonCounts(scopeTests(data.tests, data.invByAcc, makeScope({ inv: 'PSI-159' })))
    expect(flameDesign.inverse + cfig.inverse).toBe(46)
    expect(flameDesign.gas + cfig.gas).toBe(66)
  })
  it('words the clause for none, some and all', () => {
    expect(inverseClause(5, 0)).toBe('')
    expect(inverseClause(66, 46)).toBe('46 of them inverse flames whose oxygen is the burner stream, not the chamber')
    expect(inverseClause(3, 3)).toBe('all 3 of them inverse flames whose oxygen is the burner stream, not the chamber')
    expect(inverseClause(1, 1)).toBe('1 of them an inverse flame whose oxygen is the burner stream, not the chamber')
  })
  it('names the inverse flames in the region drill', () => {
    const result = resolveDrill([{ kind: 'region', id: 'moon' }], data, preset('exploration'))
    expect(result.title).toContain('46 of the 66 gas flame tests are inverse flames')
  })
  it('qualifies the solid oxygen ceiling to the tests that state their oxygen', () => {
    expect(data.insightById.I1.headline).toContain('Solid material tests in PSI that state their oxygen stop at 22.2%')
  })
})

describe('the Compare map scope', () => {
  const ids = ['PSI-102', 'PSI-101']
  it('counts the Moon Base region of the compared investigations only', () => {
    const scope = compareScope(ids)
    expect(scope).toEqual({ inv: 'PSI-102+PSI-101' })
    const tests = scopeTests(data.tests, data.invByAcc, scope)
    expect(new Set(tests.map((t) => t.accession))).toEqual(new Set(ids))
    expect(moonCounts(tests)).toEqual({ total: 0, solid: 0, liquid: 0, gas: 0, inverse: 0, edge: 0 })
    expect(scopeLabel(scope, data.invByAcc)).toBe('SAME and SAME-R')
  })
  it('keeps the scope through the drill address and counts the same tests', () => {
    const path: DrillStep[] = [{ kind: 'region', id: 'moon' }, scopeStep(compareScope(ids)) as DrillStep]
    const back = decodeDrill(new URLSearchParams({ drill: encodeDrill(path) }).get('drill'))
    expect(back).toEqual(path)
    const result = resolveDrill(back as DrillStep[], data, preset('iss'))
    expect(result.total).toBe(0)
    expect(result.title).toContain('Counted within the map filter: SAME and SAME-R')
    const flames = resolveDrill([{ kind: 'region', id: 'moon' }, scopeStep(compareScope(['PSI-159', 'PSI-69'])) as DrillStep], data, preset('iss'))
    expect(flames.total).toBe(moonCounts(scopeTests(data.tests, data.invByAcc, compareScope(['PSI-159', 'PSI-69']))).total)
  })
  it('accepts one to three well formed accessions and nothing else', () => {
    expect(makeScope({ inv: 'PSI-1+PSI-2+PSI-3' }).inv).toBe('PSI-1+PSI-2+PSI-3')
    for (const bad of ['PSI-1+PSI-2+PSI-3+PSI-4', 'PSI-1+', '+PSI-1', 'PSI-1 PSI-2', 'PSI-1,PSI-2']) expect(makeScope({ inv: bad }).inv).toBeUndefined()
  })
})

describe('the ACME BRE pressure note', () => {
  it('quotes NASA in the assumption', () => {
    const bre = snapshot.assumptions.find((a) => a.accession === BRE_ACCESSION)
    expect(bre?.reason).toContain('"The chamber pressures were also varied but are not identified in this summary table."')
  })
  it('adds the note to the gap statement of the atmospheres BRE targeted, and only those', () => {
    for (const id of ['shuttle-eva', 'exploration', 'mars']) expect(breGapNote(id)).toContain('does not say which tests ran at which pressure')
    for (const id of ['iss', 'moon-bound', 'suit', null]) expect(breGapNote(id)).toBeNull()
  })
})

describe('the Lab model end', () => {
  it('is not defined when the extinction diameter is not below the initial one', () => {
    expect(modelEndTime(3.33, 3.34, 0.33)).toBeNull()
    expect(modelEndTime(2, 2, 0.5)).toBeNull()
    expect(modelEndTime(1.86, 0.94, 0.6)).toBeCloseTo(4.293, 3)
  })
  it('gives no model end for FLEX C13H102, where the formula alone would be negative', () => {
    const test = data.testById.get('PSI-69:0:129')
    expect(test?.label).toBe('C13H102')
    const row = dropletValues(test!)!
    expect(burnTimeToExtinction(row.d0, row.dExt, row.k)).toBeLessThan(0)
    expect(modelEndTime(row.d0, row.dExt, row.k)).toBeNull()
  })
})

describe('a stale screen chunk after a deploy', () => {
  it('recognises a failed dynamic import in each browser and nothing else', () => {
    expect(isChunkError(staleChunk)).toBe(true)
    expect(isChunkError(new TypeError('error loading dynamically imported module: /assets/Lab-x.js'))).toBe(true)
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkError(new Error('Unable to preload CSS for /assets/Lab-x.css'))).toBe(true)
    expect(isChunkError(new TypeError("Cannot read properties of undefined (reading 'o2')"))).toBe(false)
    expect(isChunkError(null)).toBe(false)
  })
  it('reloads once, then lets the second failure show the error screen', () => {
    const store = memory()
    const reload = vi.fn()
    expect(reloadOnceForChunk(staleChunk, store, reload, 1_000_000)).toBe(true)
    expect(store.getItem(CHUNK_RELOAD_KEY)).toBe('1000000')
    expect(reloadOnceForChunk(staleChunk, store, reload, 1_000_000 + 5_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
    // A later deploy, long after, may reload once more.
    expect(reloadOnceForChunk(staleChunk, store, reload, 1_000_000 + CHUNK_RELOAD_WINDOW_MS + 1)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
  it('never reloads for other errors or without storage', () => {
    const reload = vi.fn()
    expect(reloadOnceForChunk(new Error('render failed'), memory(), reload)).toBe(false)
    expect(reloadOnceForChunk(staleChunk, null, reload)).toBe(false)
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota') } }
    expect(reloadOnceForChunk(staleChunk, broken, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
  it('wraps a screen loader: a stale chunk reloads, a second failure rejects as before', async () => {
    const store = memory()
    const reload = vi.fn()
    const load = withChunkReload(() => Promise.reject(staleChunk), () => store, reload)
    const first = load()
    await Promise.resolve()
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
    void first
    await expect(load()).rejects.toBe(staleChunk)
    expect(reload).toHaveBeenCalledTimes(1)
    const ok = withChunkReload(() => Promise.resolve('screen'), () => store, reload)
    await expect(ok()).resolves.toBe('screen')
  })
})

describe('the glossary', () => {
  it('defines nearby and assumed coordinates', () => {
    const ids = snapshot.glossary.map((g) => g.id)
    expect(ids).toContain('nearby')
    expect(ids).toContain('assumed-coordinates')
    expect(snapshot.glossary.find((g) => g.id === 'nearby')?.definition).toContain('within one unit of distance')
  })
})
