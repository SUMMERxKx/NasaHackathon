// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
import { describe, expect, it } from 'vitest'
import type { DrillStep, EvidenceItem } from '../types.ts'
import { applyScenario, parseScenario, scenarioLine, scenarioParams } from '../state/scenario.ts'
import { computeCoverage, scenarioPoint } from './coverage.ts'
import { countBehind, decodeDrill, encodeDrill, resolveDrill, resolveMark } from './drill.ts'
import { fieldGroups, overallFromGroups } from './field.ts'
import { REFUSAL, checkAnswer, numbersIn, splitByCitations } from './grounding.ts'
import { MAP_DOMAIN, STACK_RADIUS, layoutMap, mapScales } from './mapLayout.ts'
import { EMBED_DIM, chunksFor, decodeVectors, encodeVectors, scoreMeaning } from './meaning.ts'
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
  ]
  it('round trips every kind of step', () => {
    for (const step of steps) expect(decodeDrill(encodeDrill([step]))).toEqual([step])
    const path = [steps[2], steps[12], steps[13]]
    expect(encodeDrill(path)).toBe('region.moon~inv.PSI-159~test.PSI-159:1:12')
    expect(decodeDrill(encodeDrill(path))).toEqual(path)
  })
  it('decodes broken text to nothing', () => {
    for (const text of ['', 'nonsense', 'region.mars', 'test.', 'coverage.fun', 'rank.PSI-1,Z', 'near.a,b', 'a~b~c~d~e', 'test.DROP TABLE']) {
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
