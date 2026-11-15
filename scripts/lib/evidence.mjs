// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Builds the one evidence bundle. The site serves it and the server function reads the same file.
// Every item is text EMBER built from NASA data. It is the exact text the live model sees.
import { computeCoverage, pillarLookup, scenarioPoint } from '../../src/lib/coverage.ts'
import { materialFamily } from '../../src/lib/parse.ts'
import { countBy, groupBy, round } from '../../src/lib/stats.ts'
import { atmToPsi, formatNumber, formatPercent } from '../../src/lib/units.ts'
import { shortHash } from './util.mjs'

const MAX_CHARS = 1200

// Cuts at a sentence end so no item is over the limit.
export function clip(text, limit = MAX_CHARS) {
  const clean = String(text).replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  const cut = clean.slice(0, limit)
  const stop = cut.lastIndexOf('. ')
  return stop > limit * 0.5 ? cut.slice(0, stop + 1) : cut.slice(0, limit - 1).trimEnd() + '.'
}

const PILLAR_WORDS = { prevention: 'prevention', detection: 'detection', suppression: 'suppression', fundamentals: 'fundamentals, which supports all three pillars' }

export function fuelList(tests, limit = 8) {
  // Solid samples have free-text names, so they are listed by material family.
  const name = (t) => (t.fuelClass === 'solid' ? materialFamily(t.fuel) : t.fuel)
  const counts = Object.entries(countBy(tests.filter((t) => t.fuel), name)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return counts.slice(0, limit).map(([fuel, n]) => `${fuel} (${n})`).join(', ')
}

export function rangeText(tests) {
  const o2 = tests.filter((t) => t.o2 != null)
  const p = tests.filter((t) => t.pressureAtm != null)
  const parts = []
  if (o2.length > 0) {
    const assumed = o2.every((t) => t.o2Source === 'assumed')
    const lo = Math.min(...o2.map((t) => t.o2))
    const hi = Math.max(...o2.map((t) => t.o2))
    parts.push(lo === hi ? `Oxygen ${formatPercent(lo)}${assumed ? ', assumed' : ''}.` : `Oxygen from ${formatPercent(lo)} to ${formatPercent(hi)}.`)
  } else if (tests.length > 0) parts.push('The table states no oxygen value.')
  if (p.length > 0) {
    const assumed = p.every((t) => t.pressureSource === 'assumed')
    const lo = Math.min(...p.map((t) => atmToPsi(t.pressureAtm)))
    const hi = Math.max(...p.map((t) => atmToPsi(t.pressureAtm)))
    parts.push(lo === hi ? `Pressure ${formatNumber(lo, 1)} psi${assumed ? ', assumed' : ''}.` : `Pressure from ${formatNumber(lo, 1)} to ${formatNumber(hi, 1)} psi.`)
  }
  return parts.join(' ')
}

export function buildEvidence(snapshot, insights) {
  const items = {}
  const add = (item) => {
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(item.id)) throw new Error(`Bad evidence id: ${item.id}`)
    items[item.id] = { ...item, text: clip(item.text) }
  }
  const byAcc = groupBy(snapshot.tests, (t) => t.accession)
  const families = Object.fromEntries(snapshot.hardwareFamilies.map((f) => [f.id, f]))
  const tagLabels = Object.fromEntries(snapshot.equipmentTags.map((t) => [t.id, t.label.toLowerCase()]))

  for (const card of insights) {
    add({ id: card.id, kind: 'insight', title: card.headline, text: `${card.headline} ${card.detail}`, href: `/?drill=insight.${card.id}.${card.primary}` })
  }

  for (const inv of snapshot.investigations) {
    const tests = byAcc[inv.accession] || []
    const years = inv.startDate && inv.endDate ? ` It ran from ${inv.startDate.slice(0, 4)} to ${inv.endDate.slice(0, 4)}.` : ''
    const informs = inv.informs.length > 0 ? ` It informs ${inv.informs.map((t) => tagLabels[t]).join(' and ')}.` : ''
    const table = tests.length > 0
      ? ` Its PSI table lists ${tests.length} tests. Fuels or materials: ${fuelList(tests)}. ${rangeText(tests)}`
      : ' It has no test table in PSI.'
    add({
      id: inv.accession,
      kind: 'investigation',
      title: `${inv.displayName}: ${inv.title}`,
      text: `${inv.displayName} (${inv.accession}) is the investigation "${inv.title}". It is a ${inv.projectType.toLowerCase()} in the pillar ${PILLAR_WORDS[inv.pillar]}. Hardware: ${families[inv.hardwareFamily].name}.${years} What was burned: ${inv.summary.burned} What was varied: ${inv.summary.varied} Why it matters: ${inv.summary.matters}${informs}${table}`,
      href: `/investigations/${inv.accession}`,
    })
  }

  for (const term of snapshot.glossary) {
    add({ id: `G-${term.id}`, kind: 'glossary', title: term.term, text: `${term.term}: ${term.definition}`, href: '/methods?section=glossary' })
  }

  const lookup = pillarLookup(snapshot.investigations)
  for (const h of snapshot.habitats) {
    const c = computeCoverage(snapshot.tests, lookup, scenarioPoint(h))
    const near = Object.entries(c.nearbyByFuelClass).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${n} ${k}`).join(', ')
    add({
      id: `H-${h.id}`,
      kind: 'habitat',
      title: h.name,
      text: `${h.name}: ${formatPercent(h.o2)} oxygen at ${formatNumber(h.pressurePsi, 1)} psi, ${h.gravityLabel}. Source: ${h.source}. Evidence Coverage near this atmosphere is ${round(c.overall, 0)} out of 100: prevention ${round(c.byPillar.prevention.score, 0)}, detection ${round(c.byPillar.detection.score, 0)}, suppression ${round(c.byPillar.suppression.score, 0)}. Tests within one unit of distance: ${c.nearbyTotal}${near ? ` (${near})` : ''}. The score counts nearby flight tests. It is not a safety rating.`,
      href: `/?h=${h.id}`,
    })
  }

  const assumed = snapshot.assumptions.filter((a) => a.o2 != null)
  const methods = [
    {
      id: 'M-coverage',
      title: 'What the Evidence Coverage score means',
      text: 'Evidence Coverage measures how much real flight evidence sits close to a chosen habitat atmosphere, on a scale of 0 to 100. It is not a safety rating. Each test gets a weight that falls with its distance from the habitat: 4 points of oxygen is one unit of distance and about 25 percent in pressure is one unit. A test whose oxygen or pressure is assumed counts at half weight. For each pillar the weights of every plotted test, near or far, are summed into an effective number of tests N, and coverage is 100 × (1 − exp(−N ÷ 10)). The overall score is 0.4 × prevention plus 0.3 × detection plus 0.3 × suppression. Fundamentals tests count toward each pillar at a weight of 0.3. The constants are design choices by the team.',
      href: '/methods?section=formulas',
    },
    {
      id: 'M-ranking',
      title: 'How investigations are ranked',
      text: 'The relevance ranking is a transparent heuristic. Each investigation gets a score out of 100 from four parts: how many of its tests sit near the chosen atmosphere (weight 0.45), its fuel type (0.25, with solid materials highest), whether its pillar matches the focus pillar (0.20), and how much test data it has (0.10). Every ranked card shows the four parts under the heading Why this rank.',
      href: '/methods?section=formulas',
    },
    {
      id: 'M-dsquared',
      title: 'The d-squared law',
      text: 'The d-squared law says the square of a burning droplet\'s diameter falls in a straight line with time: d(t)² = d0² − K × t. K is the burning rate constant. The burn time to extinction is (d0² − dExt²) ÷ K. EMBER checks this against the FLEX table. The law is a classical result (Godsave 1953, Spalding 1953). The FLEX data: Dietrich and co-authors, Droplet Combustion Experiments Aboard the International Space Station, 2014.',
      href: '/lab/droplet',
    },
    {
      id: 'M-assumptions',
      title: 'Declared assumptions',
      text: `Some PSI tables do not state an atmosphere. For ${assumed.length} investigations EMBER assumes an oxygen value from cabin air: ${assumed.map((a) => `${a.accession} at ${Math.round(a.o2 * 1000) / 10}%`).join(', ')}. ${snapshot.counts.testsWithAssumedOxygen} tests have an assumed oxygen value and ${snapshot.counts.testsWithAssumedValue - snapshot.counts.testsWithAssumedOxygen} more have only an assumed pressure, about one atmosphere. The team reviewed every assumption on 15 November 2026 against the PSI records and published papers. Assumed values are drawn as hollow marks, marked as assumed in every table, and counted at half weight in the coverage score. They are never presented as measured.`,
      href: '/methods?section=assumptions',
    },
    {
      id: 'M-limits',
      title: 'Limits of EMBER',
      text: 'The Evidence Coverage score counts evidence and is not a safety rating. The ranking is a heuristic. The PSI test tables are summaries and not the full datasets. Assumed atmospheres are marked. EMBER does not say that any material, atmosphere or habitat is safe or unsafe. PSI holds no partial-gravity combustion tests, so nothing here describes how a flame behaves on the Moon or Mars.',
      href: '/methods?section=limits',
    },
  ]
  for (const m of methods) add({ ...m, kind: 'method' })

  for (const family of snapshot.hardwareFamilies) {
    const members = snapshot.investigations.filter((i) => i.hardwareFamily === family.id)
    if (members.length === 0) continue
    add({
      id: `HW-${family.id}`,
      kind: 'hardware',
      title: family.name,
      text: `Hardware family: ${family.name}. ${family.note} ${members.length} investigations shared it: ${members.map((i) => `${i.displayName} (${i.accession})`).join(', ')}.`,
      href: `/investigations?hw=${family.id}`,
    })
  }

  for (const card of snapshot.context) {
    add({
      id: card.id,
      kind: 'context',
      title: card.title,
      text: `${card.title}. ${card.text} This is context from a NASA page (${card.sourceName}). It is not test data.`,
      href: card.kind === 'spinoff' ? '/earth' : '/',
    })
  }

  const bundle = { schemaVersion: 1, bundleId: shortHash(JSON.stringify(items)), generatedBy: 'Built from the PSI snapshot and the insight cards. Wording drafted by SI and reviewed by the team.', items }
  return bundle
}

// Search documents. Several documents can point at one evidence item.
export function buildSearchIndex(snapshot, insights, bundle) {
  const docs = []
  const byAcc = groupBy(snapshot.tests, (t) => t.accession)
  for (const inv of snapshot.investigations) {
    const tests = byAcc[inv.accession] || []
    docs.push({
      id: `inv:${inv.accession}`,
      evidenceId: inv.accession,
      kind: 'investigation',
      title: inv.title,
      acronym: `${inv.displayName} ${inv.acronym || ''} ${inv.accession}`.trim(),
      keywords: inv.keywords.join(' '),
      summary: `${inv.summary.burned} ${inv.summary.varied} ${inv.summary.matters}`,
      body: clip(`${inv.objective} ${fuelList(tests, 12)} ${inv.pillar} ${inv.experimentHardware}`, 1500),
    })
    const groups = groupBy(tests.filter((t) => t.fuel), (t) => (inv.fuelClass === 'solid' ? materialFamily(t.fuel) : t.fuel))
    for (const [material, list] of Object.entries(groups).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      docs.push({
        id: `mat:${inv.accession}:${material}`,
        evidenceId: inv.accession,
        kind: 'material',
        title: `${inv.displayName}, ${material}`,
        body: `${inv.displayName} tested ${material} in ${list.length} tests. ${rangeText(list)}`,
      })
    }
    for (const profile of snapshot.tableProfiles.filter((p) => p.accession === inv.accession)) {
      const varied = profile.columns.filter((c) => c.klass === 'factor' || c.klass === 'continuous').map((c) => c.displayHeader)
      const fixed = profile.columns.filter((c) => c.klass === 'constant').map((c) => `${c.displayHeader} ${c.topValues[0]?.value ?? ''}`)
      docs.push({
        id: `table:${profile.table}`,
        evidenceId: inv.accession,
        kind: 'table',
        title: `${inv.displayName} test table`,
        body: clip(`The ${inv.displayName} table has ${profile.rows} rows. Varied: ${varied.join(', ')}. Fixed: ${fixed.join(', ') || 'nothing'}.`, 900),
      })
    }
  }
  for (const card of insights) {
    docs.push({ id: `insight:${card.id}`, evidenceId: card.id, kind: 'insight', title: card.headline, body: card.detail, ...(card.appliesWhen ? { appliesWhen: card.appliesWhen } : {}) })
  }
  const aliases = {}
  for (const term of snapshot.glossary) {
    docs.push({ id: `glossary:${term.id}`, evidenceId: `G-${term.id}`, kind: 'glossary', title: term.term, keywords: term.aliases.join(' '), body: term.definition })
    const expansion = [term.term.toLowerCase(), ...term.aliases.map((a) => a.toLowerCase())]
    for (const alias of expansion) {
      const list = aliases[alias] || []
      for (const word of expansion) if (word !== alias && !list.includes(word)) list.push(word)
      aliases[alias] = list
    }
  }
  for (const item of Object.values(bundle.items)) {
    if (item.kind === 'habitat' || item.kind === 'method' || item.kind === 'hardware' || item.kind === 'context') {
      docs.push({ id: `${item.kind}:${item.id}`, evidenceId: item.id, kind: item.kind, title: item.title, body: item.text })
    }
  }
  const sortedAliases = Object.fromEntries(Object.entries(aliases).sort((a, b) => (a[0] < b[0] ? -1 : 1)))
  return {
    schemaVersion: 1,
    buildId: snapshot.buildId,
    generatedBy: 'Built from the PSI snapshot, the insight cards and the glossary by the EMBER pipeline.',
    docs,
    aliases: sortedAliases,
    embedding: null,
  }
}
