// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Tests on the committed snapshot, the insight verification and the evidence bundle.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { EvidenceBundle, InsightsFile, SearchIndexFile, Snapshot } from '../src/types.ts'
// @ts-expect-error The build scripts are plain JavaScript modules.
import { verifyInsights, recomputeFromRaw } from './lib/verify.mjs'

const root = join(import.meta.dirname, '..')
const read = <T>(name: string): T => JSON.parse(readFileSync(join(root, 'public/data', name), 'utf8')) as T
const snapshot = read<Snapshot>('snapshot.json')
const insights = read<InsightsFile>('insights.json')
const evidence = read<EvidenceBundle>('evidence.json')
const search = read<SearchIndexFile>('search-index.json')

describe('snapshot', () => {
  it('holds the expected amount of data', () => {
    expect(snapshot.investigations.length).toBeGreaterThanOrEqual(20)
    expect(snapshot.tests.length).toBeGreaterThanOrEqual(1500)
    expect(snapshot.schemaVersion).toBe(1)
  })
  it('links every test to an investigation', () => {
    const known = new Set(snapshot.investigations.map((i) => i.accession))
    for (const t of snapshot.tests) expect(known.has(t.accession)).toBe(true)
  })
  it('keeps oxygen and pressure in range', () => {
    for (const t of snapshot.tests) {
      if (t.o2 != null) expect(t.o2 >= 0 && t.o2 <= 1).toBe(true)
      if (t.pressureAtm != null) expect(t.pressureAtm >= 0.2 && t.pressureAtm <= 6).toBe(true)
    }
  })
  it('has unique test ids', () => {
    expect(new Set(snapshot.tests.map((t) => t.id)).size).toBe(snapshot.tests.length)
  })
  it('holds no email address', () => {
    expect(readFileSync(join(root, 'public/data/snapshot.json'), 'utf8').includes('@')).toBe(false)
  })
  it('gives every investigation a display name and a summary', () => {
    for (const inv of snapshot.investigations) {
      expect(inv.displayName.length).toBeGreaterThan(0)
      expect(inv.summary.burned.length).toBeGreaterThan(0)
    }
  })
  it('stores files as null where PSI lists none', () => {
    const flex = snapshot.investigations.find((i) => i.accession === 'PSI-69')
    expect(flex?.files).toBeNull()
  })
  it('counts assumed oxygen tests as the rows of the tables named in the defaults', () => {
    const named = snapshot.assumptions.filter((a) => a.o2 != null).map((a) => a.accession)
    const rows = snapshot.tableProfiles.filter((p) => named.includes(p.accession)).reduce((a, p) => a + p.rows, 0)
    expect(snapshot.tests.filter((t) => t.o2Source === 'assumed').length).toBe(rows)
    expect(snapshot.counts.testsWithAssumedOxygen).toBe(rows)
  })
  it('keeps the raw cell beside every test', () => {
    for (const t of snapshot.tests) expect(Object.keys(t.raw).length).toBeGreaterThan(0)
  })
})

describe('insights', () => {
  it('pass both levels of verification', () => {
    const verified = verifyInsights(snapshot, insights.insights, root)
    expect(verified.length).toBe(insights.insights.length)
    for (const id of ['I1', 'I2', 'I4', 'I10']) {
      expect(insights.insights.find((c) => c.id === id)?.verified).toBe('snapshot and raw files')
    }
  })
  it('include the six must-have cards', () => {
    for (const id of ['I1', 'I2', 'I3', 'I4', 'I5', 'I12']) expect(insights.insights.some((c) => c.id === id)).toBe(true)
  })
  it('print every number that the card holds', () => {
    for (const card of insights.insights) {
      for (const key of Object.keys(card.numbers)) expect(typeof card.display[key]).toBe('string')
      expect(card.display[card.primary]).toBeDefined()
    }
  })
  it('recompute the headline numbers from the raw files', () => {
    const raw = recomputeFromRaw(root)
    expect(raw.I2.moonRegionSolid ?? 0).toBe(0)
    expect(raw.I4.tests).toBeGreaterThan(100)
  })
  it('fail when a number is edited by hand', () => {
    const edited = insights.insights.map((c) => (c.id === 'I1' ? { ...c, numbers: { ...c.numbers, maxSolidO2Pct: 30 } } : c))
    expect(() => verifyInsights(snapshot, edited, root)).toThrow()
  })
})

describe('evidence', () => {
  it('keeps every item under 1,200 characters with a valid id', () => {
    for (const [id, item] of Object.entries(evidence.items)) {
      expect(item.text.length).toBeLessThanOrEqual(1200)
      expect(id).toMatch(/^(I\d+|PSI-\d+|G-[a-z0-9-]+|H-[a-z0-9-]+|M-[a-z0-9-]+|HW-[a-z0-9-]+|C-[a-z0-9-]+)$/)
      expect(item.id).toBe(id)
    }
  })
  it('has an item for every insight and investigation', () => {
    for (const card of insights.insights) expect(evidence.items[card.id]).toBeDefined()
    for (const inv of snapshot.investigations) expect(evidence.items[inv.accession]).toBeDefined()
  })
  it('gives every search document an evidence item that exists', () => {
    for (const doc of search.docs) expect(evidence.items[doc.evidenceId]).toBeDefined()
  })
})
