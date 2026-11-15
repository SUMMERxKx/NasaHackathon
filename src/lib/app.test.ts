// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { describe, expect, it } from 'vitest'
import type { DrillStep, EvidenceItem } from '../types.ts'
import { applyScenario, parseScenario, scenarioLine, scenarioParams } from '../state/scenario.ts'
import { computeCoverage, isAssumed, scenarioPoint } from './coverage.ts'
import { countBehind, decodeDrill, encodeDrill, resolveDrill, resolveMark } from './drill.ts'
import { fieldGroups, overallFromGroups } from './field.ts'
import { REFUSAL, checkAnswer, numbersIn, splitByCitations } from './grounding.ts'
import {
  MAP_DOMAIN,
  MIN_O2_SPAN,
  MIN_PSI_RATIO,
  STACK_RADIUS,
  STACK_SPACING,
  boxDomain,
  clampDomain,
  encodeZoom,
  layoutMap,
  mapScales,
  oxygenTicks,
  panBy,
  parseZoom,
  pressureTicks,
  sameDomain,
  stackRadius,
  viewTransform,
  zoomAt,
  zoomMagnification,
} from './mapLayout.ts'
import type { MapDomain } from './mapLayout.ts'
import { makeScope, scopeStep, scopeTests } from './mapScope.ts'
import { moonCounts, onMoonEdge } from './regions.ts'
import { bindSkyClicks } from '../components/ui/halftone-nebula.tsx'
import { skyClicksAt } from '../App.tsx'
import { EMBED_DIM, chunksFor, decodeVectors, encodeVectors, scoreMeaning } from './meaning.ts'
import { NEARBY_FUELS, NO_PARTIAL_GRAVITY, gapStatement, isInverseFlame, nearbyDescription, nearbyReason, nearbyRows, nearbyTests, summarizeNearby } from './nearby.ts'
import { rankAll } from './ranking.ts'
import { buildEngine, namedInvestigations, retrieve } from './retrieve.ts'
import { flameParams } from '../three/flameParams.ts'
import { RAMP, SI_LABEL, SI_MARK, rampBytes, rampColorAt, rampGradient } from '../three/ramp.ts'
import { data, evalSet, evidence, pinned, preset, searchIndex, snapshot } from './testData.ts'

describe('scenario in the URL', () => {
  it('round trips every preset', () => {
    for (const h of snapshot.habitats) {
      const params = new URLSearchParams(scenarioParams(preset(h.id), snapshot.habitats))
      const back = parseScenario(params, snapshot.habitats)
      expect(back.presetId).toBe(h.id)
      expect(back.o2).toBe(h.o2)
      expect(back.pressurePsi).toBe(h.pressurePsi)
    }
  })
  it('clamps invalid values and falls back to the ISS cabin', () => {
    expect(parseScenario(new URLSearchParams('h=nowhere'), snapshot.habitats).presetId).toBe('iss')
    const wild = parseScenario(new URLSearchParams('o2=500&p=99&g=7&flow=900'), snapshot.habitats)
    expect(wild.o2).toBe(1)
    expect(wild.pressurePsi).toBe(15)
    expect(wild.gravity).toBe(0)
    expect(wild.flowCmS).toBe(50)
    expect(parseScenario(new URLSearchParams('o2=abc'), snapshot.habitats).presetId).toBe('iss')
  })
  it('collapses custom values that equal a preset to h=', () => {
    const custom = parseScenario(new URLSearchParams('o2=34&p=8.2&g=0.166'), snapshot.habitats)
    expect(custom.presetId).toBe('exploration')
    expect(scenarioParams(custom, snapshot.habitats)).toEqual({ h: 'exploration' })
  })
  it('keeps other parameters when the habitat is written', () => {
    const next = applyScenario(new URLSearchParams('drill=region.moon&h=iss'), preset('mars'), snapshot.habitats)
    expect(next.get('drill')).toBe('region.moon')
    expect(next.get('h')).toBe('mars')
  })
})

describe('drill codec', () => {
  const steps: DrillStep[] = [
    { kind: 'coverage', pillar: 'prevention' },
    { kind: 'coverage', pillar: 'overall' },
    { kind: 'region', id: 'moon' },
    { kind: 'near', o2: 0.34, pressureAtm: 0.558 },
    { kind: 'stack', o2: 0.21, pressureAtm: 1 },
    { kind: 'rank', accession: 'PSI-25', part: 'A' },
    { kind: 'insight', id: 'I1', number: 'maxSolidO2Pct' },
    { kind: 'column', accession: 'PSI-99', table: 0, column: 6, value: '~ 22.1' },
    { kind: 'column', accession: 'PSI-25', table: 0, column: 5, value: '1/4" clear rod, a.b' },
    { kind: 'fireball', readout: 'burningRate' },
    { kind: 'bin', chart: 'extinction', key: 'Methanol|3' },
    { kind: 'bin', chart: 'dsquared', key: 'Heptane|0.21|nitrogen only' },
    { kind: 'investigation', accession: 'PSI-159' },
    { kind: 'test', id: 'PSI-159:1:12' },
    { kind: 'test', id: 'PSI-20:0:1b' },
    { kind: 'near', o2: 0.34, pressureAtm: 0.558, fuel: 'liquid' },
    { kind: 'near', o2: 0.21, pressureAtm: 1.0003, fuel: 'aerosol' },
    { kind: 'near', o2: 0.21, pressureAtm: 1.0003, only: 'assumed' },
    { kind: 'near', o2: 0.3, pressureAtm: 0.6941, fuel: 'gas', only: 'inverse' },
  ]
  it('round trips every kind of step', () => {
    for (const step of steps) expect(decodeDrill(encodeDrill([step]))).toEqual([step])
    const path = [steps[2], steps[12], steps[13]]
    expect(encodeDrill(path)).toBe('region.moon~inv.PSI-159~test.PSI-159:1:12')
    expect(decodeDrill(encodeDrill(path))).toEqual(path)
  })
  it('keeps the address of the whole nearby subset and adds the fuel class after it', () => {
    expect(encodeDrill([{ kind: 'near', o2: 0.34, pressureAtm: 0.558 }])).toBe('near.0.34,0.558')
    expect(encodeDrill([{ kind: 'near', o2: 0.34, pressureAtm: 0.558, fuel: 'liquid' }])).toBe('near.0.34,0.558,liquid')
    expect(encodeDrill([{ kind: 'near', o2: 0.34, pressureAtm: 0.558, fuel: 'gas', only: 'inverse' }])).toBe('near.0.34,0.558,gas,inverse')
    // A step with no fuel class decodes with no fuel key at all, so it is the same step as before.
    expect(Object.keys(decodeDrill('near.0.34,0.558')?.[0] ?? {})).toEqual(['kind', 'o2', 'pressureAtm'])
  })
  it('decodes broken text to nothing', () => {
    for (const text of ['', 'nonsense', 'region.mars', 'test.', 'coverage.fun', 'rank.PSI-1,Z', 'near.a,b', 'near.0.3,0.5,wood', 'near.0.3,0.5,assumed,liquid', 'near.0.3,0.5,liquid,gas', 'near.0.3,0.5,liquid,inverse,x', 'stack.0.21,1,gas', 'a~b~c~d~e', 'test.DROP TABLE']) {
      expect(decodeDrill(text)).toBeNull()
    }
  })
})

describe('drill counts', () => {
  it('resolves the Moon Base region to 66 gas tests, with the edge tests listed apart', () => {
    const result = resolveDrill([{ kind: 'region', id: 'moon' }], data, preset('exploration'))
    const tests = result.testIds.map((id) => data.testById.get(id))
    expect(result.total).toBe(data.insightById.I2.numbers.moonRegionTests)
    expect(tests.every((t) => t?.fuelClass === 'gas')).toBe(true)
    expect(result.edge.reduce((a, g) => a + g.count, 0)).toBe(data.insightById.I2.numbers.edgeDropletTests)
    expect(result.total).toBe(66)
  })
  it('resolves the cabin air stack to every test at that point', () => {
    const result = resolveDrill([{ kind: 'stack', o2: 0.21, pressureAtm: 1 }], data, preset('iss'))
    const assumedOxygen = result.testIds.filter((id) => data.testById.get(id)?.o2Source === 'assumed').length
    expect(assumedOxygen).toBe(snapshot.counts.testsWithAssumedOxygen)
    expect(assumedOxygen).toBe(722)
  })
  it('makes each coverage segment add up to the number on the dial', () => {
    for (const h of snapshot.habitats) {
      const scenario = preset(h.id)
      const coverage = computeCoverage(data.tests, data.lookup, scenarioPoint(scenario))
      for (const pillar of ['prevention', 'detection', 'suppression'] as const) {
        const mark = resolveMark({ kind: 'coverage', pillar }, data, scenario)
        const sum = Object.values(mark.effective ?? {}).reduce((a, b) => a + b, 0)
        expect(sum).toBeCloseTo(coverage.byPillar[pillar].effectiveTests, 6)
      }
    }
  })
  it('gives the panel the same count the chart prints', () => {
    const scenario = preset('exploration')
    const near: DrillStep = { kind: 'near', o2: scenario.o2, pressureAtm: scenarioPoint(scenario).pressureAtm }
    const coverage = computeCoverage(data.tests, data.lookup, scenarioPoint(scenario))
    expect(countBehind(near, data, scenario)).toBe(coverage.nearbyTotal)
    expect(resolveDrill([near], data, scenario).total).toBe(coverage.nearbyTotal)
  })
  it('steps down to one investigation and one test', () => {
    const scenario = preset('exploration')
    const level2 = resolveDrill([{ kind: 'region', id: 'moon' }, { kind: 'investigation', accession: 'PSI-159' }], data, scenario)
    expect(level2.level).toBe('investigation')
    expect(level2.total).toBe(48)
    const id = level2.testIds[0]
    const level3 = resolveDrill([{ kind: 'region', id: 'moon' }, { kind: 'investigation', accession: 'PSI-159' }, { kind: 'test', id }], data, scenario)
    expect(level3.level).toBe('test')
    expect(level3.test?.id).toBe(id)
    expect(level3.crumbs.length).toBe(3)
  })
  it('says so when a bar has no rows behind it', () => {
    const result = resolveDrill([{ kind: 'rank', accession: 'PSI-25', part: 'F' }], data, preset('iss'))
    expect(result.total).toBe(0)
    expect(result.note).toMatch(/no rows/)
  })
  it('opens the rows behind every insight number', () => {
    for (const card of data.insights) {
      for (const key of Object.keys(card.display)) {
        const result = resolveDrill([{ kind: 'insight', id: card.id, number: key }], data, preset('iss'))
        expect(result.total > 0 || result.note != null).toBe(true)
      }
    }
    const top = resolveDrill([{ kind: 'insight', id: 'I1', number: 'maxSolidO2Pct' }], data, preset('iss'))
    expect(top.total).toBe(129)
    expect(top.highlightTestId).not.toBeNull()
  })
})

// The six rows of the audit in the dashboard critique: total, solid, liquid, gas, smoke and aerosol,
// investigations with a nearby row, nearby rows with an assumed value, inverse-flame rows.
const NEARBY_AUDIT: Record<string, [number, number, number, number, number, number, number, number]> = {
  iss: [1093, 229, 127, 618, 119, 15, 849, 11],
  'shuttle-eva': [43, 0, 43, 0, 0, 1, 0, 0],
  exploration: [24, 0, 9, 15, 0, 3, 0, 2],
  'moon-bound': [14, 0, 8, 6, 0, 2, 0, 6],
  mars: [24, 0, 9, 15, 0, 3, 0, 2],
  suit: [0, 0, 0, 0, 0, 0, 0, 0],
}

describe('nearby counts', () => {
  const at = (id: string) => scenarioPoint(preset(id))
  const near = (id: string) => ({ kind: 'near' as const, o2: at(id).o2, pressureAtm: at(id).pressureAtm })
  it('reproduce the audited counts for every preset', () => {
    expect(snapshot.habitats.map((h) => h.id).sort()).toEqual(Object.keys(NEARBY_AUDIT).sort())
    for (const [id, [total, solid, liquid, gas, aerosol, investigations, assumed, inverse]] of Object.entries(NEARBY_AUDIT)) {
      const s = summarizeNearby(data.tests, at(id))
      expect([s.total, s.byFuel.solid, s.byFuel.liquid, s.byFuel.gas, s.byFuel.aerosol, s.investigations, s.assumed, s.inverse], id).toEqual([total, solid, liquid, gas, aerosol, investigations, assumed, inverse])
      expect(s.byFuel.unknown, id).toBe(0)
    }
  })
  it('agree with the coverage result, whose formula they do not touch', () => {
    for (const h of snapshot.habitats) {
      const s = summarizeNearby(data.tests, at(h.id))
      const coverage = computeCoverage(data.tests, data.lookup, at(h.id))
      expect(s.total, h.id).toBe(coverage.nearbyTotal)
      for (const fuel of NEARBY_FUELS) expect(s.byFuel[fuel], `${h.id} ${fuel}`).toBe(coverage.nearbyByFuelClass[fuel] ?? 0)
    }
  })
  it('do not change when only gravity changes', () => {
    const exploration = snapshot.habitats.find((h) => h.id === 'exploration')
    const mars = snapshot.habitats.find((h) => h.id === 'mars')
    expect(exploration?.gravity).not.toBe(mars?.gravity)
    expect(summarizeNearby(data.tests, at('mars'))).toEqual(summarizeNearby(data.tests, at('exploration')))
    expect(resolveDrill([near('mars')], data, preset('mars')).testIds).toEqual(resolveDrill([near('exploration')], data, preset('exploration')).testIds)
  })
  it('open exactly the rows each class count prints, and the classes add up to the total', () => {
    for (const h of snapshot.habitats) {
      const scenario = preset(h.id)
      const s = summarizeNearby(data.tests, at(h.id))
      const all = resolveDrill([near(h.id)], data, scenario)
      expect(all.total, h.id).toBe(s.total)
      const seen: string[] = []
      for (const fuel of NEARBY_FUELS) {
        const step: DrillStep = { ...near(h.id), fuel }
        const result = resolveDrill([step], data, scenario)
        expect(result.total, `${h.id} ${fuel}`).toBe(s.byFuel[fuel])
        expect(countBehind(step, data, scenario), `${h.id} ${fuel}`).toBe(s.byFuel[fuel])
        expect(result.groups.reduce((a, g) => a + g.count, 0), `${h.id} ${fuel}`).toBe(s.byFuel[fuel])
        for (const id of result.testIds) expect(data.testById.get(id)?.fuelClass, id).toBe(fuel)
        seen.push(...result.testIds)
      }
      // No row is in two classes and no row is left out.
      expect(new Set(seen).size, h.id).toBe(seen.length)
      expect([...seen].sort(), h.id).toEqual([...all.testIds].sort())
    }
  })
  it('give the chart one row for each class, each with its own address and its own words', () => {
    for (const h of snapshot.habitats) {
      const scenario = preset(h.id)
      const s = summarizeNearby(data.tests, at(h.id))
      const rows = nearbyRows(s, at(h.id))
      expect(rows.map((r) => r.fuel), h.id).toEqual(['solid', 'liquid', 'gas', 'aerosol'])
      expect(rows.map((r) => r.label), h.id).toEqual(['Solid materials', 'Liquid fuels', 'Gas flames', 'Smoke and aerosols'])
      for (const row of rows) {
        const address = encodeDrill([row.step])
        expect(address, h.id).toBe(`${encodeDrill([near(h.id)])},${row.fuel}`)
        const result = resolveDrill(decodeDrill(address) ?? [], data, scenario)
        expect(result.total, `${h.id} ${row.fuel}`).toBe(row.count)
        expect(row.describe).toContain(row.count === 0 ? 'no nearby rows. Press Enter to see why.' : `${row.count} nearby test record`)
      }
    }
    const exploration = summarizeNearby(data.tests, at('exploration'))
    expect(nearbyDescription(exploration, at('exploration'), 'Exploration atmosphere')).toBe('24 NASA test records near Exploration atmosphere. Solid materials: no nearby rows. Liquid fuels: 9. Gas flames: 15. Smoke and aerosols: no nearby rows.')
  })
  it('never link a class count to the whole nearby subset', () => {
    const scenario = preset('exploration')
    const liquid = resolveDrill([{ ...near('exploration'), fuel: 'liquid' }], data, scenario)
    expect(liquid.total).toBe(9)
    expect(liquid.total).toBeLessThan(resolveDrill([near('exploration')], data, scenario).total)
    expect(liquid.title).toMatch(/^9 liquid-fuel tests within one unit of 34% oxygen and 8\.2 psi/)
  })
  it('lead from a class count to an assumed ISS row, with the raw row and the note that it is assumed', () => {
    const scenario = preset('iss')
    const step: DrillStep = { ...near('iss'), fuel: 'solid' }
    const solid = resolveDrill([step], data, scenario)
    const id = solid.testIds.find((testId) => isAssumed(data.testById.get(testId) as never))
    expect(id).toBeDefined()
    expect(solid.groups.some((g) => g.assumed > 0)).toBe(true)
    const test = data.testById.get(id as string)
    const row = resolveDrill([step, { kind: 'investigation', accession: test?.accession as string }, { kind: 'test', id: id as string }], data, scenario)
    expect(row.level).toBe('test')
    expect(row.test?.id).toBe(id)
    expect(Object.keys(row.test?.raw ?? {}).length).toBeGreaterThan(0)
    expect(row.test?.rowIndex).toBeGreaterThanOrEqual(0)
    expect(row.crumbs.length).toBe(3)
    const assumed = resolveDrill([{ ...near('iss'), only: 'assumed' }], data, scenario)
    expect(assumed.total).toBe(849)
    expect(assumed.testIds).toContain(id)
  })
  it('lead from the gas count to an inverse-flame row and say what its oxygen value is', () => {
    const scenario = preset('exploration')
    const gas = resolveDrill([{ ...near('exploration'), fuel: 'gas' }], data, scenario)
    const inverse = gas.testIds.filter((id) => isInverseFlame(data.testById.get(id) as never))
    expect(inverse.length).toBe(2)
    expect(gas.note).toMatch(/2 of these are inverse flames/)
    expect(gas.note).toMatch(/oxidizer stream, not a cabin atmosphere/)
    const only = resolveDrill([{ ...near('exploration'), only: 'inverse' }], data, scenario)
    expect([...only.testIds].sort()).toEqual([...inverse].sort())
    for (const id of only.testIds) expect(data.testById.get(id)?.fuelClass).toBe('gas')
    expect(data.testById.get(inverse[0])?.flags).toContain('oxidizer-stream')
    // Every inverse flame in the snapshot is flagged the same way in both places the pipeline writes.
    expect(data.tests.filter(isInverseFlame).length).toBe(data.tests.filter((t) => t.extra.inverse).length)
    expect(resolveDrill([{ ...near('moon-bound'), only: 'inverse' }], data, preset('moon-bound')).total).toBe(6)
  })
  it('open a clear empty state for the Spacesuit, with the rule and a way on', () => {
    const scenario = preset('suit')
    for (const step of [near('suit'), ...NEARBY_FUELS.map((fuel) => ({ ...near('suit'), fuel }))] as DrillStep[]) {
      const result = resolveDrill([step], data, scenario)
      expect(result.total).toBe(0)
      expect(result.groups).toEqual([])
      expect(result.title).toMatch(/^(0 tests|No .*test) within one unit of 100% oxygen and 4\.3 psi/)
      expect(result.note).toMatch(/evidence gap, not proof of safety or danger/)
      expect(result.formula).toMatch(/4 points of oxygen or about 25 percent in pressure/)
      expect(result.links.map((l) => l.to)).toEqual(['/investigations', '/about?section=findings', '/about?section=nearby'])
    }
    // A subset with rows in it offers no way out, because the rows are the way on.
    expect(resolveDrill([near('iss')], data, preset('iss')).links).toEqual([])
  })
  it('state one gap line for each preset, built from its counts', () => {
    const line = (id: string) => gapStatement(summarizeNearby(data.tests, at(id)), [0.166, 0.38].includes(preset(id).gravity)).join(' ')
    expect(line('iss')).toBe('Nearby evidence spans all four fuel classes. Most of these rows use assumed coordinates.')
    expect(line('shuttle-eva')).toBe('Nearby evidence is limited to liquid-fuel tests.')
    expect(line('exploration')).toBe(`No nearby solid-material or smoke tests. ${NO_PARTIAL_GRAVITY}`)
    expect(line('moon-bound')).toBe(`No nearby solid-material or smoke tests. ${NO_PARTIAL_GRAVITY}`)
    expect(line('mars')).toBe(line('exploration'))
    expect(line('suit')).toBe('No test records meet the nearby oxygen-pressure rule. This is an evidence gap, not proof of safety or danger.')
    for (const h of snapshot.habitats) expect(line(h.id)).not.toMatch(/probab|risk score|safety rating|\bsafe\b/i)
  })
  it('give each of the top three investigations the count its rows open to', () => {
    for (const h of snapshot.habitats) {
      const scenario = preset(h.id)
      const top = rankAll(snapshot.investigations, data.testsByAcc, at(h.id), null).slice(0, 3)
      for (const ranked of top) {
        const behind = resolveDrill([near(h.id), { kind: 'investigation', accession: ranked.accession }], data, scenario)
        expect(behind.total, `${h.id} ${ranked.accession}`).toBe(ranked.nearbyCount)
      }
    }
    const suit = rankAll(snapshot.investigations, data.testsByAcc, at('suit'), null).slice(0, 3)
    expect(suit.every((r) => r.nearbyCount === 0)).toBe(true)
    expect(nearbyReason(0, 129, 'solid', true)).toBe('Solid materials. Background evidence. None of its 129 tests are nearby.')
    expect(nearbyReason(13, 131, 'gas', true)).toBe('Gas flames. 13 of its 131 tests are nearby.')
    expect(nearbyReason(1, 1, 'liquid', true)).toBe('Liquid fuels. 1 of its 1 test is nearby.')
    expect(nearbyTests(data.tests, at('exploration'), { fuel: 'liquid' }).length).toBe(9)
  })
})

describe('map layout', () => {
  const box = { left: 50, top: 14, width: 700, height: 500 }
  const layout = layoutMap(data.tests, box)
  it('draws every plottable test as its own mark inside the chart area', () => {
    expect(layout.marks.length).toBe(data.tests.filter((t) => t.o2 != null && t.pressureAtm != null).length)
    expect(layout.marks.length).toBeGreaterThan(1000)
    for (const m of layout.marks) {
      expect(m.x).toBeGreaterThanOrEqual(box.left - STACK_RADIUS)
      expect(m.x).toBeLessThanOrEqual(box.left + box.width + STACK_RADIUS)
      expect(m.y).toBeGreaterThanOrEqual(box.top - STACK_RADIUS)
      expect(m.y).toBeLessThanOrEqual(box.top + box.height + STACK_RADIUS)
    }
  })
  it('keeps the cabin air stack inside a 9 pixel radius with one badge', () => {
    const stack = layout.stacks.find((s) => Math.abs(s.o2 - 0.21) < 1e-6 && Math.abs(s.pressureAtm - 1) < 1e-6)
    expect(stack).toBeDefined()
    expect(stack?.count).toBeGreaterThanOrEqual(722)
    expect(stack?.badge).toBe(true)
    const marks = layout.marks.filter((m) => m.stackKey === stack?.key)
    expect(marks.length).toBe(stack?.count)
    for (const m of marks) expect(Math.hypot(m.x - (stack?.x ?? 0), m.y - (stack?.y ?? 0))).toBeLessThanOrEqual(STACK_RADIUS + 1e-6)
  })
  it('places a test at 5 atm inside the chart area', () => {
    const { x } = mapScales(box, MAP_DOMAIN)
    const px = x(5 * 14.696)
    expect(px).toBeGreaterThan(box.left)
    expect(px).toBeLessThan(box.left + box.width)
    expect(data.tests.some((t) => t.pressureAtm === 5)).toBe(true)
  })
})

describe('map zoom', () => {
  const box = { left: 50, top: 14, width: 700, height: 500 }
  const inside = (d: MapDomain) => {
    expect(d.psi[0]).toBeGreaterThanOrEqual(MAP_DOMAIN.psi[0] - 1e-9)
    expect(d.psi[1]).toBeLessThanOrEqual(MAP_DOMAIN.psi[1] + 1e-9)
    expect(d.o2Pct[0]).toBeGreaterThanOrEqual(MAP_DOMAIN.o2Pct[0] - 1e-9)
    expect(d.o2Pct[1]).toBeLessThanOrEqual(MAP_DOMAIN.o2Pct[1] + 1e-9)
  }
  it('keeps the point under the pointer in place, on the log pressure axis too', () => {
    const fx = 0.62
    const fy = 0.18
    const before = mapScales(box, MAP_DOMAIN)
    const px = box.left + fx * box.width
    const py = box.top + (1 - fy) * box.height
    const psi = before.x.invert(px)
    const o2 = before.y.invert(py)
    const next = zoomAt(MAP_DOMAIN, fx, fy, 4)
    const after = mapScales(box, next)
    expect(after.x(psi)).toBeCloseTo(px, 6)
    expect(after.y(o2)).toBeCloseTo(py, 6)
    // Four times in: a quarter of the log span and a quarter of the oxygen span.
    expect(Math.log(next.psi[1] / next.psi[0])).toBeCloseTo(Math.log(MAP_DOMAIN.psi[1] / MAP_DOMAIN.psi[0]) / 4, 9)
    expect(next.o2Pct[1] - next.o2Pct[0]).toBeCloseTo(90 / 4, 9)
    expect(zoomMagnification(next)).toBeCloseTo(4, 9)
  })
  it('zooms back out to exactly the whole map and never past it', () => {
    const inThenOut = zoomAt(zoomAt(MAP_DOMAIN, 0.3, 0.7, 3), 0.3, 0.7, 1 / 3)
    expect(sameDomain(inThenOut, MAP_DOMAIN)).toBe(true)
    const far = zoomAt(zoomAt(MAP_DOMAIN, 0.9, 0.1, 2), 0.1, 0.9, 1 / 50)
    expect(sameDomain(far, MAP_DOMAIN)).toBe(true)
  })
  it('stops at the narrowest view and stays inside the map at the edges', () => {
    let d = MAP_DOMAIN
    for (let i = 0; i < 40; i += 1) d = zoomAt(d, 1, 0, 3)
    inside(d)
    expect(d.psi[1] / d.psi[0]).toBeCloseTo(MIN_PSI_RATIO, 9)
    expect(d.o2Pct[1] - d.o2Pct[0]).toBeCloseTo(MIN_O2_SPAN, 9)
    expect(d.psi[1]).toBeCloseTo(MAP_DOMAIN.psi[1], 9)
    expect(d.o2Pct[0]).toBeCloseTo(MAP_DOMAIN.o2Pct[0], 9)
  })
  it('pans by the drag and slides back inside the map, keeping the zoom', () => {
    const d = zoomAt(MAP_DOMAIN, 0.5, 0.5, 4)
    const moved = panBy(d, -0.25, 0.25)
    // A drag to the left shows higher pressure, a drag down shows more oxygen, by a quarter view each.
    expect(Math.log(moved.psi[0] / d.psi[0])).toBeCloseTo(Math.log(d.psi[1] / d.psi[0]) / 4, 9)
    expect(moved.o2Pct[0] - d.o2Pct[0]).toBeCloseTo((d.o2Pct[1] - d.o2Pct[0]) / 4, 9)
    const pushed = panBy(d, -10, -10)
    inside(pushed)
    expect(pushed.psi[1]).toBeCloseTo(MAP_DOMAIN.psi[1], 9)
    expect(pushed.o2Pct[0]).toBeCloseTo(MAP_DOMAIN.o2Pct[0], 9)
    expect(zoomMagnification(pushed)).toBeCloseTo(4, 9)
  })
  it('zooms to a box drawn on the plot, in either drag direction', () => {
    const { x, y } = mapScales(box, MAP_DOMAIN)
    const a = { x: x(10), y: y(40) }
    const b = { x: x(20), y: y(15) }
    for (const d of [boxDomain(MAP_DOMAIN, box, a, b), boxDomain(MAP_DOMAIN, box, b, a)]) {
      expect(d.psi[0]).toBeCloseTo(10, 9)
      expect(d.psi[1]).toBeCloseTo(20, 9)
      expect(d.o2Pct[0]).toBeCloseTo(15, 9)
      expect(d.o2Pct[1]).toBeCloseTo(40, 9)
    }
    // A box thinner than the narrowest view grows to it around its own centre.
    const thin = boxDomain(MAP_DOMAIN, box, { x: x(14.7), y: y(21) }, { x: x(14.7) + 0.5, y: y(21) + 0.5 })
    expect(thin.psi[1] / thin.psi[0]).toBeCloseTo(MIN_PSI_RATIO, 9)
    expect(thin.o2Pct[1] - thin.o2Pct[0]).toBeCloseTo(MIN_O2_SPAN, 9)
  })
  it('gives the stand-in transform that lands each test where the new layout puts it', () => {
    const from = zoomAt(MAP_DOMAIN, 0.4, 0.3, 2)
    const to = zoomAt(from, 0.7, 0.2, 3)
    const { kx, ky, tx, ty } = viewTransform(from, to, box)
    const a = mapScales(box, from)
    const b = mapScales(box, to)
    for (const [psi, o2] of [[14.7, 21], [10.2, 26.5], [8.2, 34]]) {
      expect(kx * a.x(psi) + tx).toBeCloseTo(b.x(psi), 6)
      expect(ky * a.y(o2) + ty).toBeCloseTo(b.y(o2), 6)
    }
  })
  it('writes the zoom to the address and reads the same view back', () => {
    const d = zoomAt(MAP_DOMAIN, 0.58, 0.12, 6.3)
    const text = encodeZoom(d)
    expect(text).toMatch(/^[\d.]+-[\d.]+_[\d.]+-[\d.]+$/)
    const back = parseZoom(text)
    expect(back).not.toBeNull()
    expect(encodeZoom(back as MapDomain)).toBe(text)
    expect(parseZoom('moon')).toBeNull()
    expect(parseZoom('20-10_10-30')).toBeNull()
    expect(parseZoom('')).toBeNull()
    expect(parseZoom(null)).toBeNull()
    // A view past the map is brought back inside it.
    const wide = parseZoom('1-500_0-120') as MapDomain
    expect(sameDomain(wide, clampDomain(MAP_DOMAIN))).toBe(true)
  })
  it('opens the cabin air stack as the map zooms in, until each test can be pointed at alone', () => {
    const cabin = (d: MapDomain) => {
      const l = layoutMap(data.tests, box, d)
      const stack = l.stacks.find((s) => Math.abs(s.o2 - 0.21) < 1e-6 && Math.abs(s.pressureAtm - 1) < 1e-6)
      return { stack, marks: l.marks.filter((m) => m.stackKey === stack?.key) }
    }
    const whole = cabin(MAP_DOMAIN)
    expect(whole.stack?.open).toBe(false)
    expect(whole.marks.every((m) => !m.single)).toBe(true)
    const n = whole.stack?.count ?? 0
    expect(stackRadius(n, 1).radius).toBe(STACK_RADIUS)
    expect(stackRadius(n, 3).radius).toBe(STACK_RADIUS * 3)
    // Zoomed in on the cabin far enough, the stack is spread at the mark spacing and open.
    const { x, y } = mapScales(box, MAP_DOMAIN)
    const fx = (x(14.696) - box.left) / box.width
    const fy = 1 - (y(21) - box.top) / box.height
    const d = zoomAt(MAP_DOMAIN, fx, fy, 40)
    const near = cabin(d)
    expect(near.stack?.open).toBe(true)
    expect(near.marks.every((m) => m.single)).toBe(true)
    // Neighbours in the sunflower sit about one spacing apart, so the nearest mark is the one pointed at.
    const ms = near.marks
    let closest = Infinity
    for (let i = 0; i < ms.length; i += 1) {
      for (let j = i + 1; j < ms.length; j += 1) closest = Math.min(closest, Math.hypot(ms[i].x - ms[j].x, ms[i].y - ms[j].y))
    }
    expect(closest).toBeGreaterThan(STACK_SPACING * 0.5)
  })
  it('labels a zoomed axis with round numbers, and keeps the named ticks on the whole map', () => {
    expect(pressureTicks(MAP_DOMAIN)).toEqual([3, 4.3, 8.2, 10.2, 14.7, 30, 50, 80])
    expect(oxygenTicks(MAP_DOMAIN)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    const d: MapDomain = { psi: [13.5, 16], o2Pct: [19, 24] }
    const xs = pressureTicks(d)
    const ys = oxygenTicks(d)
    expect(xs.length).toBeGreaterThanOrEqual(3)
    expect(ys.length).toBeGreaterThanOrEqual(3)
    for (const t of xs) expect(t >= 13.5 && t <= 16).toBe(true)
    for (const t of ys) expect(t >= 19 && t <= 24).toBe(true)
  })
})

describe('map filter scope', () => {
  const scoped = (inv: string) => scopeTests(data.tests, data.invByAcc, makeScope({ inv }))
  it('gives the map the same tests as the heading and the table', () => {
    for (const [inv, plotted] of [['PSI-25', 129], ['PSI-99', 9], ['PSI-69', 273]] as const) {
      const tests = scoped(inv).filter((t) => t.o2 != null && t.pressureAtm != null)
      expect(tests.length).toBe(plotted)
      expect(tests.every((t) => t.accession === inv)).toBe(true)
      const layout = layoutMap(tests, { left: 50, top: 14, width: 700, height: 500 })
      expect(layout.marks.length).toBe(plotted)
      // Every stack counts only tests of the filter.
      for (const stack of layout.stacks) expect(Object.keys(stack.byAccession)).toEqual([inv])
    }
  })
  it('counts the Moon Base region within the filter, as its drill does', () => {
    expect(moonCounts(data.tests)).toMatchObject({ solid: 0, liquid: 0, gas: 66, edge: 17 })
    expect(moonCounts(scoped('PSI-25'))).toEqual({ total: 0, solid: 0, liquid: 0, gas: 0, edge: 0 })
    expect(moonCounts(scoped('PSI-99'))).toEqual({ total: 0, solid: 0, liquid: 0, gas: 0, edge: 0 })
    expect(moonCounts(scoped('PSI-69'))).toEqual({ total: 0, solid: 0, liquid: 0, gas: 0, edge: 17 })
    for (const inv of ['PSI-25', 'PSI-99', 'PSI-69']) {
      const step = scopeStep(makeScope({ inv }))
      expect(step).not.toBeNull()
      const result = resolveDrill([{ kind: 'region', id: 'moon' }, step as DrillStep], data, preset('iss'))
      expect(result.total).toBe(moonCounts(scoped(inv)).total)
      expect(result.edge.reduce((n, g) => n + g.count, 0)).toBe(scoped(inv).filter(onMoonEdge).length)
      expect(result.title).toContain('Counted within the map filter')
    }
  })
  it('narrows a stack drill to the filter and keeps the filter in every crumb', () => {
    const step = scopeStep(makeScope({ inv: 'PSI-25' })) as DrillStep
    const cabin: DrillStep = { kind: 'stack', o2: 0.21, pressureAtm: 1 }
    const all = resolveDrill([cabin], data, preset('iss'))
    const within = resolveDrill([cabin, step], data, preset('iss'))
    expect(within.total).toBeLessThan(all.total)
    expect(within.groups.map((g) => g.accession)).toEqual(['PSI-25'])
    expect(within.crumbs[0].path).toEqual([cabin, step])
    const test = resolveDrill([cabin, step, { kind: 'test', id: within.testIds[0] }], data, preset('iss'))
    expect(test.level).toBe('test')
    expect(test.crumbs[0].path).toEqual([cabin, step])
  })
  it('writes the filter into the drill address and reads it back, refusing broken parts', () => {
    const step = scopeStep(makeScope({ pillar: 'prevention', fuel: 'solid', inv: 'PSI-25', hw: 'cir-acme' })) as DrillStep
    const path: DrillStep[] = [{ kind: 'region', id: 'moon' }, step]
    expect(encodeDrill(path)).toBe('region.moon~scope.prevention,solid,PSI-25,cir-acme')
    expect(decodeDrill(encodeDrill(path))).toEqual(path)
    expect(decodeDrill('region.moon~scope.,,PSI-99,')).toEqual([{ kind: 'region', id: 'moon' }, { kind: 'scope', inv: 'PSI-99' }])
    for (const text of ['region.moon~scope.,,,', 'region.moon~scope.wood,,,', 'region.moon~scope.,,PSI-x,', 'region.moon~scope.,,PSI-25', 'region.moon~scope.,,PSI-25,,x']) {
      expect(decodeDrill(text)).toBeNull()
    }
    expect(scopeStep(makeScope({}))).toBeNull()
  })
})

describe('sky clicks', () => {
  it('are on for the hero only', () => {
    expect(skyClicksAt('/')).toBe(true)
    for (const path of ['/dashboard', '/investigations', '/investigations/PSI-100', '/compare', '/lab', '/lab/flame', '/about']) expect(skyClicksAt(path)).toBe(false)
  })
  it('attach no pointer listener at all when off, and one that can be taken off when on', () => {
    const target = new EventTarget()
    let calls = 0
    const added: string[] = []
    const add = target.addEventListener.bind(target)
    target.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      added.push(type)
      add(type, listener, options)
    }
    const onDown = () => {
      calls += 1
    }
    const off = bindSkyClicks(target, onDown, false)
    target.dispatchEvent(new Event('pointerdown'))
    expect(added).toEqual([])
    expect(calls).toBe(0)
    off()
    const unbind = bindSkyClicks(target, onDown, true)
    expect(added).toEqual(['pointerdown'])
    target.dispatchEvent(new Event('pointerdown'))
    expect(calls).toBe(1)
    unbind()
    target.dispatchEvent(new Event('pointerdown'))
    expect(calls).toBe(1)
  })
})

describe('coverage field', () => {
  it('equals the overall score at the habitat point', () => {
    const groups = fieldGroups(data.tests, data.lookup)
    for (const h of snapshot.habitats) {
      const point = scenarioPoint(h)
      expect(overallFromGroups(groups, point)).toBeCloseTo(computeCoverage(data.tests, data.lookup, point).overall, 6)
    }
  })
})

describe('ramp', () => {
  it('feeds the scale bar and the shader from the same array', () => {
    const gradient = rampGradient()
    for (const stop of RAMP) expect(gradient).toContain(stop.color)
    const bytes = rampBytes(256)
    const first = rampColorAt(0)
    const last = rampColorAt(1)
    expect([bytes[0], bytes[1], bytes[2]]).toEqual(first)
    expect([bytes[255 * 4], bytes[255 * 4 + 1], bytes[255 * 4 + 2]]).toEqual(last)
  })
  it('maps temperature to colour in one direction only', () => {
    const light = (t: number) => {
      const [r, g, b] = rampColorAt(t)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    for (let i = 1; i <= 100; i += 1) expect(light(i / 100)).toBeGreaterThanOrEqual(light((i - 1) / 100) - 1e-9)
  })
  it('carries the small mark and the words it stands for', () => {
    expect(SI_MARK).toBe('SI')
    expect(SI_LABEL).toBe('SI-generated illustration')
  })
})

describe('flame params', () => {
  it('gives each preset the readout numbers of the plan', () => {
    const iss = flameParams(preset('iss'), data.tests).lookup
    expect([iss.flexNear.length, iss.burningRate.value, iss.burningRate.tests.length, iss.extinction.ended.length]).toEqual([165, 0.51, 39, 111])
    expect(Math.round(iss.flameTemperature.value ?? 0)).toBe(2180)
    expect(iss.flameTemperature.tests.length).toBe(146)
    const exploration = flameParams(preset('exploration'), data.tests).lookup
    expect([exploration.flexNear.length, exploration.burningRate.value, exploration.burningRate.tests.length, exploration.extinction.ended.length]).toEqual([9, 0.715, 8, 0])
    expect(Math.round(exploration.flameTemperature.value ?? 0)).toBe(2573)
    const moon = flameParams(preset('moon-bound'), data.tests).lookup
    expect([moon.flexNear.length, moon.burningRate.value, moon.extinction.ended.length]).toEqual([15, 0.65, 2])
    const eva = flameParams(preset('shuttle-eva'), data.tests).lookup
    expect(eva.burningRate.tests.length).toBe(0)
    expect(eva.burningRate.interpolated).toBe(true)
    expect(eva.extinction.ended.length).toBe(7)
  })
  it('gives the ghost state when no droplet test is in range', () => {
    const suit = flameParams(preset('suit'), data.tests)
    expect(suit.ghost).toBe(true)
    expect(suit.inputs.evidence).toBe(0)
    expect(suit.nearestText).toMatch(/percent oxygen and/)
    expect(flameParams(preset('iss'), data.tests).ghost).toBe(false)
  })
  it('never lowers the burning input when oxygen rises', () => {
    let last = -1
    for (let o2 = 0.12; o2 <= 0.36; o2 += 0.01) {
      const p = flameParams({ ...preset('iss'), presetId: null, o2: Math.round(o2 * 100) / 100 }, data.tests)
      if (p.lookup.burningRate.value == null) continue
      expect(p.inputs.vigor).toBeGreaterThanOrEqual(last - 0.12)
      last = Math.max(last, p.inputs.vigor)
    }
    const low = flameParams({ ...preset('iss'), presetId: null, o2: 0.13 }, data.tests).inputs.vigor
    const high = flameParams({ ...preset('iss'), presetId: null, o2: 0.34 }, data.tests).inputs.vigor
    expect(high).toBeGreaterThan(low)
  })
  it('matches the readout to its drill panel', () => {
    const scenario = preset('exploration')
    const look = flameParams(scenario, data.tests).lookup
    expect(resolveDrill([{ kind: 'fireball', readout: 'burningRate' }], data, scenario).total).toBe(look.burningRate.tests.length)
    expect(resolveDrill([{ kind: 'fireball', readout: 'outcomes' }], data, scenario).total).toBe(look.extinction.of.length)
    expect(resolveDrill([{ kind: 'fireball', readout: 'flameTemperature' }], data, scenario).total).toBe(look.flameTemperature.tests.length)
  })
})

describe('grounding', () => {
  const pack: EvidenceItem[] = [evidence.items.I1, evidence.items.I3, evidence.items['PSI-69']]
  const line = scenarioLine(preset('exploration'), snapshot.habitats)
  it('passes a correct cited answer', () => {
    const answer = 'Solid material tests in PSI stop at 22.2% oxygen [I1]. PSI holds 0 partial-gravity combustion investigations [I3]. FLEX burned single droplets of methanol and heptane [PSI-69].'
    const result = checkAnswer(answer, pack, line)
    expect(result.verdict).toBe('verified')
    expect(result.kept).toBe(3)
    expect(result.removed).toBe(0)
  })
  it('removes an invented number, an unknown id and an uncited sentence', () => {
    const answer = 'Solid material tests in PSI stop at 41.7% oxygen [I1]. PSI holds 0 partial-gravity combustion investigations [I9]. The highest oxygen level in any solid material test is in BASS-II. Solid material tests in PSI stop at 22.2% oxygen [I1]. PSI holds 0 partial-gravity combustion investigations [I3].'
    const result = checkAnswer(answer, pack, line)
    const reasons = result.segments.filter((s) => s.status === 'removed').map((s) => s.reason)
    expect(reasons).toContain('number_not_in_source')
    expect(reasons).toContain('unknown_id')
    expect(result.kept).toBe(2)
    const tail = checkAnswer('Solid material tests in PSI stop at 22.2% oxygen [I1]. This last sentence has no source', pack, line)
    expect(tail.segments.at(-1)?.reason).toBe('no_citation')
  })
  it('accepts the refusal sentence, also when other text follows it', () => {
    expect(checkAnswer(REFUSAL, pack, line).verdict).toBe('refusal')
    expect(checkAnswer(`${REFUSAL} But here is a guess anyway.`, pack, line).verdict).toBe('refusal')
  })
  it('splits by citations with the full stop on either side', () => {
    expect(splitByCitations('One thing is true. [I1] Another thing is true [I3].').length).toBe(2)
    expect(splitByCitations('A value of 22.2% was seen, e.g. in tests [I1].').length).toBe(1)
    expect(splitByCitations('Two sources back this [I1][I3].')[0].cites).toEqual(['I1', 'I3'])
  })
  it('matches numbers after dropping trailing zeros and separators', () => {
    expect(numbersIn('22.20% and 1,923 s')).toEqual(['22.2', '1923'])
    expect(checkAnswer('Solid material tests in PSI stop at 22.20% oxygen [I1]. PSI holds 0 partial-gravity combustion investigations [I3].', pack, line).kept).toBe(2)
    expect(checkAnswer('Solid material tests in PSI stop at 22% oxygen [I1]. PSI holds 0 partial-gravity combustion investigations [I3].', pack, line).kept).toBe(1)
  })
  it('lets a number from the habitat line pass with no other source', () => {
    const result = checkAnswer('The Exploration atmosphere has 34% oxygen at 8.2 psi in Moon gravity [S]. Solid material tests in PSI stop at 22.2% oxygen [I1].', pack, line)
    expect(result.kept).toBe(2)
  })
  it('does not read PSI-69 as the number 69', () => {
    expect(numbersIn('PSI-69 burned droplets')).toEqual([])
  })
  it('removes verdict language and keeps the plain phrase fire safety', () => {
    expect(checkAnswer('This atmosphere is safe [I1]. Solid material tests in PSI stop at 22.2% oxygen [I1].', pack, line).segments[0].reason).toBe('verdict_language')
    const kept = checkAnswer('FLEX directly contributes to fire safety with droplet tests of methanol and heptane [PSI-69]. Solid material tests in PSI stop at 22.2% oxygen [I1].', pack, line)
    expect(kept.kept).toBe(2)
    const rating = checkAnswer('The Evidence Coverage score is a safety rating for a habitat [I1]. Solid material tests in PSI stop at 22.2% oxygen [I1].', pack, line)
    expect(rating.segments[0].reason).toBe('verdict_language')
  })
  it('removes a sentence that shares too few words with its source', () => {
    const result = checkAnswer('I am a pirate [I3]. Solid material tests in PSI stop at 22.2% oxygen [I1].', pack, line)
    expect(result.segments[0].reason).toBe('low_overlap')
    expect(result.verdict).toBe('rejected')
  })
  it('allows numbers from either item when a sentence cites two', () => {
    const result = checkAnswer('Solid tests stop at 22.2% oxygen and PSI holds 0 partial-gravity combustion investigations [I1][I3]. Solid material tests in PSI stop at 22.2% oxygen [I1].', pack, line)
    expect(result.kept).toBe(2)
  })
})

describe('retrieval', () => {
  const engine = buildEngine(searchIndex)
  const ctxFor = (habitat?: string) => ({ scenario: preset(habitat ?? 'iss'), investigations: snapshot.investigations, tests: snapshot.tests, habitats: snapshot.habitats })
  it('finds the must-retrieve item for at least 11 of 12 real questions', () => {
    let found = 0
    for (const q of evalSet.real) {
      const ids = retrieve(q.question, engine, ctxFor(q.habitat)).pack.map((p) => p.evidenceId)
      const ok =
        (q.mustRetrieve ? q.mustRetrieve.every((id) => ids.includes(id)) : true) &&
        (q.mustRetrieveAny ? ids.some((id) => id.startsWith(q.mustRetrieveAny as string)) : true) &&
        (q.mustRetrieveOneOf ? q.mustRetrieveOneOf.some((id) => ids.includes(id)) : true)
      if (ok) found += 1
    }
    expect(found).toBeGreaterThanOrEqual(11)
  })
  it('stops an off topic question at the gate', () => {
    const result = retrieve('Who won the World Cup?', engine, ctxFor())
    expect(result.hasEvidence).toBe(false)
    expect(result.pack).toEqual([])
  })
  it('puts a named investigation first', () => {
    expect(retrieve('What did SAME-R measure about smoke?', engine, ctxFor()).pack[0].evidenceId).toBe('PSI-101')
    expect(retrieve('Tell me about BASS-II materials', engine, ctxFor()).pack[0].evidenceId).toBe('PSI-25')
    expect(namedInvestigations('is it the same on Mars', snapshot.investigations)).toEqual([])
  })
  it('keeps the pack within the server limit and sets the habitat from the question', () => {
    for (const q of [...evalSet.real, ...evalSet.trick]) {
      const result = retrieve(q.question, engine, ctxFor())
      expect(result.pack.length).toBeLessThanOrEqual(7)
      expect(result.pack.filter((p) => p.evidenceId.startsWith('PSI-')).length).toBeLessThanOrEqual(5)
    }
    expect(retrieve('What do we know about fire at 34 percent oxygen?', engine, ctxFor()).scenarioChange).toEqual({ o2: 0.34 })
  })
})

describe('search by meaning', () => {
  const unit = (index: number): Float32Array => {
    const v = new Float32Array(EMBED_DIM)
    v[index] = 1
    return v
  }
  it('round trips vectors through signed bytes and base64', () => {
    const decoded = decodeVectors(encodeVectors([unit(0), unit(5)]))
    expect(decoded.length).toBe(2 * EMBED_DIM)
    expect(decoded[0]).toBe(127)
    expect(decoded[EMBED_DIM + 5]).toBe(127)
  })
  it('scores a document by its best chunk', () => {
    const embedding = { model: 'Xenova/all-MiniLM-L6-v2' as const, dtype: 'q8' as const, dim: 384 as const, encoding: 'int8-base64' as const, chunkDocIds: ['a', 'a', 'b'], vectors: encodeVectors([unit(0), unit(1), unit(2)]) }
    const scores = scoreMeaning(unit(1), embedding, decodeVectors(embedding.vectors))
    expect(scores.get('a')).toBeCloseTo(1, 5)
    expect(scores.get('b')).toBeCloseTo(0, 5)
  })
  it('splits an investigation into at most three chunks of at most 200 words', () => {
    const doc = searchIndex.docs.find((d) => d.kind === 'investigation')
    const long = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunksFor(doc as (typeof searchIndex.docs)[number], { objective: long, hypothesis: long, approach: long, impacts: long })
    expect(chunks.length).toBeLessThanOrEqual(3)
    for (const chunk of chunks) expect(chunk.split(' ').length).toBeLessThanOrEqual(200)
  })
  it('ships one vector per chunk, built with the same model and precision as the browser uses', () => {
    const embedding = searchIndex.embedding
    if (!embedding) return
    expect(embedding.model).toBe('Xenova/all-MiniLM-L6-v2')
    expect(embedding.dtype).toBe('q8')
    expect(decodeVectors(embedding.vectors).length).toBe(embedding.chunkDocIds.length * EMBED_DIM)
    const known = new Set(searchIndex.docs.map((d) => d.id))
    for (const id of embedding.chunkDocIds) expect(known.has(id)).toBe(true)
  })
  it('lets a strong match by meaning pass the gate and join the pack', () => {
    const engine = buildEngine(searchIndex)
    const ctx = { scenario: preset('iss'), investigations: snapshot.investigations, tests: snapshot.tests, habitats: snapshot.habitats }
    const question = 'zzqx vvkp'
    expect(retrieve(question, engine, ctx).hasEvidence).toBe(false)
    const result = retrieve(question, engine, ctx, new Map([['inv:PSI-102', 0.62], ['inv:PSI-47', 0.41]]))
    expect(result.mode).toBe('keyword+meaning')
    expect(result.hasEvidence).toBe(true)
    expect(result.pack[0].evidenceId).toBe('PSI-102')
    expect(retrieve(question, engine, ctx, new Map([['inv:PSI-102', 0.1]])).hasEvidence).toBe(false)
  })
})

describe('pinned answers', () => {
  it('still pass the checker against the current bundle', () => {
    for (const answer of pinned.answers.filter((a) => a.reviewed)) {
      const pack = answer.evidenceIds.filter((id) => id !== 'S').map((id) => evidence.items[id])
      expect(pack.every(Boolean)).toBe(true)
      const text = answer.segments.map((s) => `${s.text} ${s.cites.map((c) => `[${c}]`).join('')}.`).join(' ')
      const line = answer.scenario ? scenarioLine(answer.scenario, snapshot.habitats) : scenarioLine(preset('iss'), snapshot.habitats)
      expect(checkAnswer(text, pack, line).verdict).toBe('verified')
    }
  })
})
