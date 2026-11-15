// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Computes every number used by the insight cards from the snapshot. Wording is filled in from the numbers.
import { computeCoverage, pillarLookup, scenarioPoint } from '../../src/lib/coverage.ts'
import { diluentFamily, dropletValues, extinctionRatio, validateDSquared } from '../../src/lib/droplet.ts'
import { materialFamily } from '../../src/lib/parse.ts'
import { inMoonRegion, inverseClause, onMoonEdge } from '../../src/lib/regions.ts'
import { isInverseFlame } from '../../src/lib/nearby.ts'
import { countBy, groupBy, median, round } from '../../src/lib/stats.ts'
import { atmToPsi, formatBytes, formatCount, formatNumber, formatPercent } from '../../src/lib/units.ts'

const GENERATED_BY = 'computed from PSI snapshot, wording drafted by SI and reviewed by the team'
const ids = (tests) => tests.map((t) => t.id)
const pct = (fraction) => formatPercent(fraction, 1)

export const OXYGEN_BANDS = [
  { key: '10-15', label: '10 to 15%', min: 0.1, max: 0.15 },
  { key: '15-19', label: '15 to 19%', min: 0.15, max: 0.19 },
  { key: '19-23', label: '19 to 23%', min: 0.19, max: 0.23 },
  { key: '28-36', label: '28 to 36%', min: 0.28, max: 0.36 },
]
const inBand = (t, band) => t.o2 != null && t.o2 >= band.min - 1e-9 && t.o2 < band.max - 1e-9

function card(base) {
  return { ...base, generatedBy: GENERATED_BY, reviewed: false, verified: 'snapshot' }
}

export function buildInsightList(snapshot) {
  const tests = snapshot.tests
  const names = Object.fromEntries(snapshot.investigations.map((i) => [i.accession, i.displayName]))
  const byAcc = groupBy(tests, (t) => t.accession)
  const withO2 = tests.filter((t) => t.o2 != null)
  const out = []

  // I1. Highest oxygen in any solid fuel test.
  {
    const solid = tests.filter((t) => t.fuelClass === 'solid' && t.o2Source === 'table')
    const max = Math.max(...solid.map((t) => t.o2))
    const top = solid.filter((t) => t.o2 === max)
    const topInv = names[top[0].accession]
    const topInvTests = solid.filter((t) => t.accession === top[0].accession)
    // Solid tests whose tables give no oxygen are left out of the maximum, and the card says so.
    const unstated = tests.filter((t) => t.fuelClass === 'solid' && t.o2Source !== 'table')
    const unstatedIn = [...new Set(unstated.map((t) => names[t.accession]))].join(' and ')
    const above30 = tests.filter((t) => t.fuelClass === 'solid' && t.o2 != null && t.o2 >= 0.3 - 1e-9)
    out.push(card({
      id: 'I1',
      pillar: 'gap',
      headline: `Solid material tests in PSI that state their oxygen stop at ${pct(max)}. A Moon Base is planned at 30% or more.`,
      detail: `The highest oxygen level in any solid material test whose table states oxygen is ${pct(max)}, in ${topInv}, over ${topInvTests.length} tests. ${solid.length} solid material tests state their oxygen. The other ${unstated.length}, in ${unstatedIn}, have no oxygen in their tables. PSI holds ${above30.length} solid material tests at or above 30% oxygen. The challenge statement names two planned experiments that could close this gap: the Lunar-g Combustion Investigation (LUCI) and Flammability of Materials on the Moon (FM2).`,
      numbers: { maxSolidO2Pct: round(max * 100, 3), solidTestsWithTableOxygen: solid.length, topInvestigationTests: topInvTests.length, solidTestsAtOrAbove30: above30.length },
      display: { maxSolidO2Pct: pct(max), solidTestsWithTableOxygen: String(solid.length), topInvestigationTests: String(topInvTests.length), solidTestsAtOrAbove30: String(above30.length) },
      primary: 'maxSolidO2Pct',
      evidence: Object.entries(groupBy(solid, (t) => t.accession)).map(([accession, list]) => ({ accession, table: list[0].table, testIds: ids(list), field: 'oxygen' })),
      byNumber: { maxSolidO2Pct: ids(topInvTests), topInvestigationTests: ids(topInvTests), solidTestsWithTableOxygen: ids(solid), solidTestsAtOrAbove30: ids(above30) },
      highlight: top[0].id,
      formula: 'The largest oxygen value among solid material tests whose oxygen is stated in the table.',
      appliesWhen: { minO2: 0.25 },
    }))
  }

  // I2. Where the high oxygen evidence comes from, and the Moon Base region.
  {
    const high = withO2.filter((t) => t.o2 >= 0.3 - 1e-9)
    const byClass = countBy(high, (t) => t.fuelClass)
    const moon = tests.filter(inMoonRegion)
    const edge = tests.filter(onMoonEdge)
    const moonClass = countBy(moon, (t) => t.fuelClass)
    const moonInverse = moon.filter((t) => t.fuelClass === 'gas' && isInverseFlame(t))
    const inverseText = moonInverse.length > 0 ? `, ${inverseClause(moonClass.gas || 0, moonInverse.length)}` : ''
    const edgePsi = edge.map((t) => atmToPsi(t.pressureAtm))
    const edgeDroplet = edge.filter((t) => t.fuelClass === 'liquid')
    const highLiquid = high.filter((t) => t.fuelClass === 'liquid')
    const groups = groupBy(high, (t) => t.accession)
    const invList = Object.entries(groups).map(([a, l]) => `${names[a]} ${l.length}`).join(', ')
    out.push(card({
      id: 'I2',
      pillar: 'gap',
      headline: `Inside the Moon Base region PSI holds ${moon.length} tests, and all ${moonClass.gas || 0} are gas flames${inverseText}. ${moonClass.solid || 0} solid, ${moonClass.liquid || 0} liquid.`,
      detail: `The region is 30% oxygen or more at 10.2 psi or less, from the challenge statement. Counting every test at or above 30% oxygen at any pressure gives ${high.length}: ${byClass.gas || 0} gas flame tests, ${byClass.liquid || 0} droplet tests and ${byClass.solid || 0} solid material tests (${invList}). ${edgeDroplet.length} FLEX droplet tests sit just outside the region, at ${formatNumber(Math.min(...edgePsi), 1)} to ${formatNumber(Math.max(...edgePsi), 1)} psi.`,
      numbers: {
        moonRegionTests: moon.length, moonRegionGas: moonClass.gas || 0, moonRegionInverse: moonInverse.length, moonRegionSolid: moonClass.solid || 0, moonRegionLiquid: moonClass.liquid || 0,
        edgeDropletTests: edgeDroplet.length, testsAtOrAbove30: high.length, gasAtOrAbove30: byClass.gas || 0, liquidAtOrAbove30: byClass.liquid || 0, solidAtOrAbove30: byClass.solid || 0,
      },
      display: {
        moonRegionTests: String(moon.length), moonRegionGas: String(moonClass.gas || 0), moonRegionInverse: String(moonInverse.length), moonRegionSolid: String(moonClass.solid || 0), moonRegionLiquid: String(moonClass.liquid || 0),
        edgeDropletTests: String(edgeDroplet.length), testsAtOrAbove30: String(high.length), gasAtOrAbove30: String(byClass.gas || 0), liquidAtOrAbove30: String(byClass.liquid || 0), solidAtOrAbove30: String(byClass.solid || 0),
      },
      primary: 'moonRegionTests',
      evidence: Object.entries(groups).map(([accession, list]) => ({ accession, testIds: ids(list), field: 'oxygen' })),
      byNumber: {
        moonRegionTests: ids(moon), moonRegionGas: ids(moon.filter((t) => t.fuelClass === 'gas')), moonRegionInverse: ids(moonInverse), moonRegionSolid: [], moonRegionLiquid: [],
        edgeDropletTests: ids(edgeDroplet), testsAtOrAbove30: ids(high), gasAtOrAbove30: ids(high.filter((t) => t.fuelClass === 'gas')), liquidAtOrAbove30: ids(highLiquid), solidAtOrAbove30: [],
      },
      formula: 'A test is inside the region when its table states oxygen of 0.30 or more and a pressure of 10.2 psi or less.',
      appliesWhen: { minO2: 0.25 },
    }))
  }

  // I3. Partial gravity.
  {
    const types = snapshot.counts.projectTypes
    const micro = Object.entries(types).filter(([k]) => /microgravity/i.test(k)).reduce((a, [, v]) => a + v, 0)
    const ground = Object.entries(types).filter(([k]) => /ground/i.test(k)).reduce((a, [, v]) => a + v, 0)
    const partial = Object.entries(types).filter(([k]) => /partial|lunar|martian/i.test(k)).reduce((a, [, v]) => a + v, 0)
    out.push(card({
      id: 'I3',
      pillar: 'gap',
      headline: `PSI holds ${partial} partial-gravity combustion investigations. All ${snapshot.investigations.length} are microgravity or ground studies.`,
      detail: `Of the ${snapshot.investigations.length} combustion investigations, ${micro} are microgravity investigations and ${ground} are ground investigations. None ran at Moon or Mars gravity. The challenge statement says microgravity and normal gravity results could bound what occurs in between, and that the ACME E-FIELD Flames experiment mimicked partial gravity with an electric field.`,
      numbers: { partialGravityInvestigations: partial, microgravityInvestigations: micro, groundInvestigations: ground, investigations: snapshot.investigations.length },
      display: { partialGravityInvestigations: String(partial), microgravityInvestigations: String(micro), groundInvestigations: String(ground), investigations: String(snapshot.investigations.length) },
      primary: 'partialGravityInvestigations',
      evidence: snapshot.investigations.map((i) => ({ accession: i.accession, field: 'projectType' })),
      byNumber: {},
      formula: 'A count of the Project Type field over all combustion investigations.',
      appliesWhen: { gravity: [0.166, 0.38] },
    }))
  }

  // I4. The d-squared law against FLEX.
  {
    const flex = tests.filter((t) => t.accession === 'PSI-69')
    const v = validateDSquared(flex)
    out.push(card({
      id: 'I4',
      pillar: 'method',
      headline: `The d-squared law's predicted FLEX burn time has a median of ${formatNumber(v.median, 3)} times the measured one, across ${v.points.length} tests. That is a median ratio, not an error bound.`,
      detail: `For the ${v.points.length} FLEX tests that list a starting diameter, an extinction diameter, a burning rate and a burn time, the predicted burn time divided by the measured one has a median of ${formatNumber(v.median, 3)}. Half of the tests fall between ${formatNumber(v.q1, 3)} and ${formatNumber(v.q3, 3)}. The median shows where the middle of the tests sits and says nothing about the error of any one test. Each prediction uses the burning rate and the diameters from its own row, so this checks that the table agrees with the law. It is not an independent test of a fire model. The burning rate column lost its unit in the file. EMBER reads it as mm² per second.`,
      numbers: { medianRatio: round(v.median, 3), q1: round(v.q1, 3), q3: round(v.q3, 3), tests: v.points.length },
      display: { medianRatio: formatNumber(v.median, 3), q1: formatNumber(v.q1, 3), q3: formatNumber(v.q3, 3), tests: String(v.points.length) },
      primary: 'medianRatio',
      evidence: [{ accession: 'PSI-69', table: flex[0].table, testIds: v.points.map((p) => p.testId), field: 'burn time' }],
      byNumber: {},
      formula: 'Predicted burn time = (d0² − dExt²) ÷ K. The ratio is predicted ÷ measured.',
    }))
  }

  // I5. Extinction against oxygen.
  {
    const flex = tests.filter((t) => t.accession === 'PSI-69')
    const numbers = {}
    const display = {}
    const byNumber = {}
    const parts = []
    for (const band of OXYGEN_BANDS) {
      const inside = flex.filter((t) => inBand(t, band))
      const ext = inside.filter((t) => t.outcome === 'Extinction')
      const key = band.key.replace('-', 'to')
      numbers[`tests${key}`] = inside.length
      numbers[`extinction${key}`] = ext.length
      display[`tests${key}`] = String(inside.length)
      display[`extinction${key}`] = String(ext.length)
      byNumber[`tests${key}`] = ids(inside)
      byNumber[`extinction${key}`] = ids(ext)
      parts.push(`${ext.length} of ${inside.length} at ${band.label}`)
    }
    const low = OXYGEN_BANDS[0].key.replace('-', 'to')
    const high = OXYGEN_BANDS[3].key.replace('-', 'to')
    // The ratio is read only where the flame went out. Disruption and completion rows also list a
    // final diameter, but it is not the diameter at which the flame went out.
    const ratios = flex.filter((t) => t.outcome === 'Extinction' && typeof t.extra.d0 === 'number' && typeof t.extra.dExt === 'number' && t.extra.d0 > 0)
    const lowRatios = ratios.filter((t) => inBand(t, OXYGEN_BANDS[0]))
    const highRatios = ratios.filter((t) => inBand(t, OXYGEN_BANDS[3]))
    const rLow = median(lowRatios.map((t) => extinctionRatio(t.extra.d0, t.extra.dExt)))
    const rHigh = median(highRatios.map((t) => extinctionRatio(t.extra.d0, t.extra.dExt)))
    // The headline figure is printed with its denominator, so it reads on its own.
    display[`extinction${high}`] = `${numbers[`extinction${high}`]} of ${numbers[`tests${high}`]}`
    numbers.medianRatioLow = round(rLow, 2)
    numbers.medianRatioHigh = round(rHigh, 2)
    numbers.ratioTestsLow = lowRatios.length
    numbers.ratioTestsHigh = highRatios.length
    display.medianRatioLow = formatNumber(rLow, 2)
    display.medianRatioHigh = formatNumber(rHigh, 2)
    display.ratioTestsLow = String(lowRatios.length)
    display.ratioTestsHigh = String(highRatios.length)
    byNumber.medianRatioLow = ids(lowRatios)
    byNumber.medianRatioHigh = ids(highRatios)
    byNumber.ratioTestsLow = ids(lowRatios)
    byNumber.ratioTestsHigh = ids(highRatios)
    const plural = (n) => (n === 1 ? 'test' : 'tests')
    out.push(card({
      id: 'I5',
      pillar: 'suppression',
      headline: `In FLEX, flames went out in ${numbers[`extinction${low}`]} of ${numbers[`tests${low}`]} droplet tests at 10 to 15% oxygen and in ${numbers[`extinction${high}`]} of ${numbers[`tests${high}`]} at 28 to 36%.`,
      detail: `Tests that ended in extinction by oxygen band: ${parts.join(', ')}. Where the flame went out, the median extinction ratio, the flame-out diameter divided by the starting diameter, is ${display.medianRatioLow} at 10 to 15% oxygen (${lowRatios.length} ${plural(lowRatios.length)}) and ${display.medianRatioHigh} at 28 to 36% (${highRatios.length} ${plural(highRatios.length)}). Tests that ended in disruption or burned to completion are left out of the ratio. These counts mix fuels, pressures and added gases, so they show a direction and not a limit.`,
      numbers,
      display,
      primary: `extinction${high}`,
      evidence: [{ accession: 'PSI-69', table: flex[0].table, testIds: ids(flex.filter((t) => OXYGEN_BANDS.some((b) => inBand(t, b)))), field: 'Test end' }],
      byNumber,
      formula: 'A count of the Test end column by oxygen band. A band such as 10 to 15% runs from 10 up to, and not including, 15.',
    }))
  }

  // I6. FLEX outcomes by fuel.
  {
    const flex = tests.filter((t) => t.accession === 'PSI-69')
    const numbers = { tests: flex.length }
    const display = { tests: String(flex.length) }
    const byNumber = { tests: ids(flex) }
    const lines = []
    for (const fuel of ['Methanol', 'Heptane']) {
      const list = flex.filter((t) => t.fuel === fuel)
      const key = fuel.toLowerCase()
      numbers[`${key}Tests`] = list.length
      display[`${key}Tests`] = String(list.length)
      byNumber[`${key}Tests`] = ids(list)
      const bits = []
      for (const outcome of ['Extinction', 'Disruption', 'Completion']) {
        const hit = list.filter((t) => t.outcome === outcome)
        numbers[`${key}${outcome}`] = hit.length
        display[`${key}${outcome}`] = String(hit.length)
        byNumber[`${key}${outcome}`] = ids(hit)
        bits.push(`${hit.length} ${outcome.toLowerCase()}`)
      }
      lines.push(`${fuel}, ${list.length} tests: ${bits.join(', ')}`)
    }
    const ext = flex.filter((t) => t.outcome === 'Extinction')
    numbers.extinctionAll = ext.length
    display.extinctionAll = `${ext.length} of ${flex.length}`
    byNumber.extinctionAll = ids(ext)
    out.push(card({
      id: 'I6',
      pillar: 'suppression',
      headline: `${ext.length} of ${flex.length} FLEX droplet tests ended with the visible flame going out before the fuel was gone.`,
      detail: `${lines.join('. ')}. Extinction means the visible flame went out. Disruption means the droplet broke up. Completion means it burned away. A flame going out is not proof that all burning stopped, because FLEX also found cool flames.`,
      numbers,
      display,
      primary: 'extinctionAll',
      evidence: [{ accession: 'PSI-69', table: flex[0].table, testIds: ids(flex), field: 'Test end' }],
      byNumber,
      formula: 'A count of the Test end column, by fuel.',
    }))
  }

  // I7. Saffire-II, microgravity against normal gravity burn length.
  {
    const saffire = tests.filter((t) => t.accession === 'PSI-99')
    const single = saffire.filter((t) => typeof t.extra.ugBurnLengthCm === 'number' && typeof t.extra.g1BurnLengthCm === 'number' && !/&/.test(t.fuel || ''))
    const shorter = single.filter((t) => t.extra.ugBurnLengthCm < t.extra.g1BurnLengthCm)
    const same = single.filter((t) => t.extra.ugBurnLengthCm === t.extra.g1BurnLengthCm)
    const longer = single.filter((t) => t.extra.ugBurnLengthCm > t.extra.g1BurnLengthCm)
    const silicone = shorter.filter((t) => /silicone/i.test(t.fuel || ''))
    // "The same length" splits into samples that burned their full length in both and samples
    // that barely burned in either. Saying "burned the same length" for a sample at 0 overclaims.
    const sameFull = same.filter((t) => typeof t.extra.sampleLengthCm === 'number' && t.extra.ugBurnLengthCm === t.extra.sampleLengthCm)
    const sameNone = same.filter((t) => t.extra.ugBurnLengthCm === 0)
    const sameText = [
      sameFull.length > 0 ? `${sameFull.length} ${sameFull.length === 1 ? 'sample' : 'samples'} burned the full length in both` : '',
      sameNone.length > 0 ? `${sameNone.length} barely burned in either` : '',
      same.length - sameFull.length - sameNone.length > 0 ? `${same.length - sameFull.length - sameNone.length} burned the same partial length in both` : '',
    ].filter(Boolean)
    const sameSentence = sameText.length === 0 ? 'No sample burned the same length in both.' : `${sameText.join(', and ').replace(/^./, (c) => c.toUpperCase())}.`
    out.push(card({
      id: 'I7',
      pillar: 'prevention',
      headline: `In Saffire-II, ${shorter.length} of ${single.length} single-material samples burned a shorter length in microgravity than in normal gravity. ${longer.length} burned longer.`,
      detail: `${sameSentence} ${silicone.length} of the shorter ones were silicone samples that burned in normal gravity and barely burned in microgravity. The table gives lengths as text such as "Complete" and "~ 10 cm", which EMBER reads as the full sample length and 10 cm. This is ${saffire.length} samples at one flow speed and about 22% oxygen, so it bounds the question and does not settle it.`,
      numbers: { samples: saffire.length, compared: single.length, shorterInMicrogravity: shorter.length, sameLength: same.length, sameFullLength: sameFull.length, sameBarelyBurned: sameNone.length, longerInMicrogravity: longer.length, siliconeShorter: silicone.length },
      display: { samples: String(saffire.length), compared: String(single.length), shorterInMicrogravity: `${shorter.length} of ${single.length}`, sameLength: String(same.length), sameFullLength: String(sameFull.length), sameBarelyBurned: String(sameNone.length), longerInMicrogravity: String(longer.length), siliconeShorter: String(silicone.length) },
      primary: 'shorterInMicrogravity',
      evidence: [{ accession: 'PSI-99', table: saffire[0].table, testIds: ids(saffire), field: 'burn length' }],
      byNumber: { samples: ids(saffire), compared: ids(single), shorterInMicrogravity: ids(shorter), sameLength: ids(same), sameFullLength: ids(sameFull), sameBarelyBurned: ids(sameNone), longerInMicrogravity: ids(longer), siliconeShorter: ids(silicone) },
      formula: 'A row by row comparison of the µg Burn Length and 1-g Burn Length columns.',
    }))
  }

  // I8. BASS-II materials.
  {
    const bass2 = tests.filter((t) => t.accession === 'PSI-25')
    const families = groupBy(bass2, (t) => materialFamily(t.fuel))
    const order = Object.entries(families).sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
    const numbers = { tests: bass2.length, families: order.length }
    const display = { tests: String(bass2.length), families: String(order.length) }
    const byNumber = { tests: ids(bass2) }
    const lines = []
    order.forEach(([family, list], i) => {
      const o2 = list.map((t) => t.o2).filter((v) => v != null)
      const key = `family${i + 1}`
      numbers[key] = list.length
      display[key] = String(list.length)
      byNumber[key] = ids(list)
      const lo = Math.min(...o2)
      const hi = Math.max(...o2)
      lines.push(`${family}: ${list.length} ${list.length === 1 ? 'test' : 'tests'}, oxygen ${lo === hi ? pct(lo) : `${pct(lo)} to ${pct(hi)}`}`)
    })
    const allO2 = bass2.map((t) => t.o2).filter((v) => v != null)
    numbers.minO2Pct = round(Math.min(...allO2) * 100, 3)
    numbers.maxO2Pct = round(Math.max(...allO2) * 100, 3)
    display.minO2Pct = pct(Math.min(...allO2))
    display.maxO2Pct = pct(Math.max(...allO2))
    out.push(card({
      id: 'I8',
      pillar: 'prevention',
      headline: `BASS-II burned ${bass2.length} solid samples in ${order.length} material groups, at ${display.minO2Pct} to ${display.maxO2Pct} oxygen.`,
      detail: `${lines.join('. ')}. EMBER groups the free-text sample names in the table into these families. Pressure is not in the table and is assumed to be one atmosphere.`,
      numbers,
      display,
      primary: 'tests',
      evidence: [{ accession: 'PSI-25', table: bass2[0].table, testIds: ids(bass2), field: 'Fuel Sample Material' }],
      byNumber,
      formula: 'A count of the Fuel Sample Material column, grouped into material families.',
    }))
  }

  // I9. SAME-R smoke tests.
  {
    const same = tests.filter((t) => t.accession === 'PSI-101')
    const mats = Object.entries(groupBy(same, (t) => t.fuel || 'Not stated')).sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
    const aging = same.map((t) => t.extra.netAgingS).filter((v) => typeof v === 'number')
    const numbers = { tests: same.length, materials: mats.length, minAgingS: Math.min(...aging), maxAgingS: Math.max(...aging), testsWithAging: aging.length }
    const display = { tests: String(same.length), materials: String(mats.length), minAgingS: `${Math.min(...aging)} s`, maxAgingS: `${formatCount(Math.max(...aging))} s`, testsWithAging: String(aging.length) }
    const byNumber = { tests: ids(same), testsWithAging: ids(same.filter((t) => typeof t.extra.netAgingS === 'number')) }
    mats.forEach(([, list], i) => {
      numbers[`material${i + 1}`] = list.length
      display[`material${i + 1}`] = String(list.length)
      byNumber[`material${i + 1}`] = ids(list)
    })
    out.push(card({
      id: 'I9',
      pillar: 'detection',
      headline: `SAME-R made smoke from ${mats.length} materials in ${same.length} tests and let it age for ${display.minAgingS} to ${display.maxAgingS} before measuring it.`,
      detail: `Tests by material: ${mats.map(([m, l]) => `${m} ${l.length}`).join(', ')}. ${aging.length} tests list a net ageing time. Smoke particles grow as smoke ages, and particle size decides whether a detector sees them. The atmosphere is not in the table and is assumed to be cabin air.`,
      numbers,
      display,
      primary: 'tests',
      evidence: [{ accession: 'PSI-101', table: same[0].table, testIds: ids(same), field: 'Net aging time (sec)' }],
      byNumber,
      formula: 'A count of the Sample Type column and the range of the Net aging time column.',
    }))
  }

  // I10. Highest oxygen tested anywhere.
  {
    const max = Math.max(...withO2.map((t) => t.o2))
    const top = withO2.filter((t) => t.o2 >= max - 0.0005)
    const groups = groupBy(top, (t) => t.accession)
    const allInverse = top.every((t) => t.extra.inverse === true)
    out.push(card({
      id: 'I10',
      pillar: 'fundamentals',
      headline: `The highest oxygen level in any PSI combustion test is ${formatPercent(max, 0)}, in ${top.length} inverse gas flame tests.`,
      detail: `${Object.entries(groups).map(([a, l]) => `${names[a]} ${l.length}`).join(', ')}. ${allInverse ? 'Every one is an inverse flame, where the oxidizer flows from the burner into a fuel gas.' : 'Most are inverse flames.'} So ${formatPercent(max, 0)} is the oxygen level of the oxidizer stream and not of a cabin atmosphere.`,
      numbers: { maxO2Pct: round(max * 100, 1), testsAtMax: top.length },
      display: { maxO2Pct: formatPercent(max, 0), testsAtMax: String(top.length) },
      primary: 'maxO2Pct',
      evidence: Object.entries(groups).map(([accession, list]) => ({ accession, table: list[0].table, testIds: ids(list), field: 'XO2' })),
      byNumber: {},
      formula: 'The largest oxygen value in any table.',
    }))
  }

  // I11. Archive size.
  {
    const sized = snapshot.investigations.filter((i) => i.totalFileSizeBytes != null).sort((a, b) => b.totalFileSizeBytes - a.totalFileSizeBytes)
    const total = sized.reduce((a, i) => a + i.totalFileSizeBytes, 0)
    const top3 = sized.slice(0, 3)
    const tb = (bytes) => round(bytes / 1e12, 2)
    out.push(card({
      id: 'I11',
      pillar: 'data',
      headline: `The ${snapshot.investigations.length} combustion investigations hold ${formatNumber(tb(total), 1)} TB of archived data. The test tables EMBER reads are a summary of it.`,
      detail: `The three largest archives are ${top3.map((i) => `${i.displayName} at ${formatBytes(i.totalFileSizeBytes)}`).join(', ')}. EMBER works from the experimental tables, which list one row per test, and not from the raw video and sensor files.`,
      numbers: { totalTB: tb(total), investigations: snapshot.investigations.length, largestTB: tb(top3[0].totalFileSizeBytes) },
      display: { totalTB: `${formatNumber(tb(total), 1)} TB`, investigations: String(snapshot.investigations.length), largestTB: `${formatNumber(tb(top3[0].totalFileSizeBytes), 2)} TB` },
      primary: 'totalTB',
      evidence: sized.map((i) => ({ accession: i.accession, field: 'totalFileSize' })),
      byNumber: {},
      formula: 'The sum of the totalFileSize field over all combustion investigations.',
    }))
  }

  // I12. Evidence Coverage for each preset habitat.
  {
    const lookup = pillarLookup(snapshot.investigations)
    const numbers = {}
    const display = {}
    const lines = []
    for (const h of snapshot.habitats) {
      const c = computeCoverage(tests, lookup, scenarioPoint(h))
      const key = h.id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
      numbers[key] = round(c.overall, 0)
      display[key] = String(round(c.overall, 0))
      lines.push(`${h.name} ${round(c.overall, 0)}`)
    }
    const iss = numbers.iss
    const exploration = numbers.exploration
    out.push(card({
      id: 'I12',
      pillar: 'method',
      headline: `Evidence Coverage is ${iss} out of 100 near the ISS cabin and ${exploration} near the Exploration atmosphere.`,
      detail: `Evidence Coverage by habitat: ${lines.join(', ')}. The score weights every flight test by how close it is to each atmosphere, with tests that rest on an assumed value at half weight. It is not a safety rating.`,
      numbers,
      display,
      primary: 'exploration',
      evidence: Object.keys(byAcc).map((accession) => ({ accession, field: 'oxygen and pressure' })),
      byNumber: {},
      formula: 'coverage = 100 × (1 − exp(−N ÷ 10)) per pillar. overall = 0.4 × prevention + 0.3 × detection + 0.3 × suppression.',
    }))
  }

  return out
}

export function buildInsightsFile(snapshot) {
  return {
    schemaVersion: 1,
    buildId: snapshot.buildId,
    generatedBy: 'Numbers computed from the PSI snapshot. Wording drafted by SI and reviewed by the team.',
    insights: buildInsightList(snapshot),
  }
}

export { diluentFamily, dropletValues }
