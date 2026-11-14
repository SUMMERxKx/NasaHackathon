// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Retrieval. Keyword search with alias expansion is the path that always works.
// Search by meaning, when its model has loaded, is merged in by reciprocal rank.
import MiniSearch from 'minisearch'
import type { Habitat, Investigation, RetrievalResult, Scenario, SearchDoc, SearchIndexFile, Test } from '../types.ts'
import { materialFamily } from './parse.ts'
import { atmToPsi } from './units.ts'

export type SearchEngine = {
  index: MiniSearch<SearchDoc>
  docs: SearchDoc[]
  docById: Map<string, SearchDoc>
  aliases: Record<string, string[]>
}

const STOP = new Set(
  'a an and are as at be been but by can could did do does for from had has have how i if in into is it its may me more most my no not of on or our so such tell than that the their them then there these they this those to us was we were what when where which while who whom why will with would you your about any some know known please show give find list anywhere level levels'.split(' '),
)

const KIND_WEIGHT: Record<string, number> = { insight: 1.25, investigation: 1.0, material: 1.0, table: 0.9, glossary: 0.9, method: 0.8, habitat: 0.8, hardware: 0.8, context: 0.7 }
export const MAX_PACK = 6
export const MAX_INVESTIGATIONS = 4
export const GATE_SHARE = 0.4
export const MEANING_GATE = 0.3

export function buildEngine(file: SearchIndexFile): SearchEngine {
  const index = new MiniSearch<SearchDoc>({
    fields: ['acronym', 'title', 'keywords', 'summary', 'body'],
    storeFields: ['evidenceId', 'kind'],
    searchOptions: { boost: { acronym: 4, title: 3, keywords: 2, summary: 2, body: 1 }, prefix: true, fuzzy: 0.2, combineWith: 'OR' },
  })
  index.addAll(file.docs)
  return { index, docs: file.docs, docById: new Map(file.docs.map((d) => [d.id, d])), aliases: file.aliases }
}

export function questionWords(question: string): string[] {
  const words = question.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? []
  return [...new Set(words.filter((w) => w.length > 1 && !STOP.has(w)))]
}

// Query terms are expanded with glossary aliases, such as "CO2" for carbon dioxide and "lunar" for Moon.
export function expandQuery(question: string, aliases: Record<string, string[]>): string {
  const lower = ` ${question.toLowerCase().replace(/[^a-z0-9% .-]/g, ' ').replace(/\s+/g, ' ')} `
  const extra: string[] = []
  for (const [alias, expansion] of Object.entries(aliases)) {
    if (lower.includes(` ${alias} `) || lower.includes(` ${alias}s `) || lower.includes(` ${alias}? `) || lower.includes(` ${alias}. `)) {
      for (const word of expansion.slice(0, 6)) if (!extra.includes(word)) extra.push(word)
    }
  }
  return `${question} ${extra.join(' ')}`.trim()
}

// Does at least 40 percent of the question's content words match some document? At least one must.
export function passesGate(question: string, engine: SearchEngine): boolean {
  const words = questionWords(question)
  if (words.length === 0) return false
  let matched = 0
  for (const word of words) {
    if (engine.index.search(word, { prefix: false, fuzzy: false }).length > 0) matched += 1
  }
  return matched >= 1 && matched / words.length >= GATE_SHARE
}

export type RetrieveContext = {
  scenario: Scenario
  investigations: Investigation[]
  tests: Test[]
  habitats: Habitat[]
}

// Finds an investigation that the question names by acronym, display name or accession.
export function namedInvestigations(question: string, investigations: Investigation[]): string[] {
  const hits: { accession: string; length: number }[] = []
  for (const inv of investigations) {
    const names = [inv.displayName, inv.acronym ?? '', inv.displayName.replace(/^ACME /, '')].filter((n) => n.length >= 3)
    let best = 0
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s/-]+/g, '[\\s/-]*')
      // Short acronyms such as SAME and BASS must match in capitals, so the word "same" does not count.
      const pattern = new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9]|-[A-Za-z0-9])`, /^[A-Z0-9\s/-]+$/.test(name) ? '' : 'i')
      if (pattern.test(question)) best = Math.max(best, name.length)
    }
    if (new RegExp(`\\b${inv.accession}\\b`, 'i').test(question)) best = Math.max(best, 20)
    if (best > 0) hits.push({ accession: inv.accession, length: best })
  }
  return hits.sort((a, b) => b.length - a.length).map((h) => h.accession)
}

// Looks for an oxygen percentage, a pressure, a material and an investigation name in the question.
export function parseQuestion(question: string, ctx: RetrieveContext) {
  const o2Match = question.match(/(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)(?:\s+(?:oxygen|o2))?/i)
  const o2 = o2Match && /oxygen|o2|%|percent/i.test(question) ? Number(o2Match[1]) / 100 : null
  const pMatch = question.match(/(\d{1,2}(?:\.\d+)?)\s*psi/i)
  const pressurePsi = pMatch ? Number(pMatch[1]) : null
  const lower = question.toLowerCase()
  const materials = ['pmma', 'acrylic', 'nomex', 'sibal', 'cotton', 'fabric', 'silicone', 'kapton', 'teflon', 'pyrell', 'lampwick', 'methanol', 'heptane', 'ethylene', 'methane', 'propane', 'butane', 'ethane', 'dodecane', 'hydrogen', 'propylene']
  const material = materials.find((m) => lower.includes(m)) ?? null
  return { o2: o2 != null && o2 >= 0.1 && o2 <= 1 ? o2 : null, pressurePsi: pressurePsi != null && pressurePsi >= 3 && pressurePsi <= 80 ? pressurePsi : null, material, named: namedInvestigations(question, ctx.investigations) }
}

function structuredRows(question: string, ctx: RetrieveContext): { rows: RetrievalResult['rows']; scenarioChange: RetrievalResult['scenarioChange'] } {
  const q = parseQuestion(question, ctx)
  let list: Test[] | null = null
  const parts: string[] = []
  if (q.o2 != null) {
    const o2 = q.o2
    list = ctx.tests.filter((t) => t.o2 != null && Math.abs(t.o2 - o2) <= 0.015 + 1e-9)
    parts.push(`oxygen within 1.5 points of ${Math.round(o2 * 1000) / 10}%`)
  }
  if (q.pressurePsi != null) {
    const p = q.pressurePsi
    list = (list ?? ctx.tests).filter((t) => t.pressureAtm != null && Math.abs(atmToPsi(t.pressureAtm) - p) <= p * 0.1)
    parts.push(`pressure within 10 percent of ${p} psi`)
  }
  if (q.material) {
    const m = q.material === 'fabric' || q.material === 'cotton' ? 'sibal' : q.material === 'acrylic' ? 'pmma' : q.material
    list = (list ?? ctx.tests).filter((t) => `${t.fuel ?? ''} ${materialFamily(t.fuel)}`.toLowerCase().includes(m) || (q.material === 'fabric' && /nomex|fabric/i.test(t.fuel ?? '')))
    parts.push(`material matching "${q.material}"`)
  }
  if (q.named.length > 0 && list) {
    const named = list.filter((t) => q.named.includes(t.accession))
    if (named.length > 0) list = named
  }
  const change: Partial<Scenario> = {}
  if (q.o2 != null && q.o2 >= 0.12) change.o2 = q.o2
  if (q.pressurePsi != null && q.pressurePsi <= 15) change.pressurePsi = q.pressurePsi
  return {
    rows: list && parts.length > 0 ? { filter: parts.join(', '), testIds: list.slice(0, 300).map((t) => t.id) } : null,
    scenarioChange: Object.keys(change).length > 0 ? change : null,
  }
}

function appliesNow(doc: SearchDoc, scenario: Scenario): boolean {
  const when = doc.appliesWhen
  if (!when) return false
  if (when.minO2 != null && scenario.o2 < when.minO2) return false
  if (when.maxO2 != null && scenario.o2 > when.maxO2) return false
  if (when.gravity && !when.gravity.includes(scenario.gravity)) return false
  return true
}

// meaning: similarity by document id, when the embedding model has loaded. Null means keyword only.
export function retrieve(question: string, engine: SearchEngine, ctx: RetrieveContext, meaning: Map<string, number> | null = null): RetrievalResult {
  const { rows, scenarioChange } = structuredRows(question, ctx)
  const keyword = engine.index.search(expandQuery(question, engine.aliases)).slice(0, 20)
  const meaningTop = meaning ? [...meaning.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20) : []
  const bestMeaning = meaningTop[0]?.[1] ?? 0
  const hasEvidence = passesGate(question, engine) || (meaning != null && bestMeaning >= MEANING_GATE)
  const mode = meaning ? 'keyword+meaning' : 'keyword'
  if (!hasEvidence) return { mode, hasEvidence: false, pack: [], rows: null, scenarioChange: null }

  // Merge the two lists by reciprocal rank. No tuning is needed between two score scales.
  const scores = new Map<string, number>()
  keyword.forEach((hit, rank) => scores.set(String(hit.id), (scores.get(String(hit.id)) ?? 0) + 1 / (60 + rank + 1)))
  meaningTop.forEach(([id], rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (60 + rank + 1)))
  const named = namedInvestigations(question, ctx.investigations)
  // What the question is after changes which kind of evidence should lead.
  const lowerQ = question.toLowerCase()
  const wantsHardware = /hardware|\brack\b|glovebox|apparatus|facility|shared/.test(lowerQ)
  const wantsDefinition = /^\s*what (is|are) an? /.test(lowerQ) || /\bdefine\b|what does .* mean/.test(lowerQ)
  const wantsList = /^\s*which\b|\blist\b/.test(lowerQ)
  const items = new Map<string, { score: number; docs: string[] }>()
  for (const [docId, base] of scores) {
    const doc = engine.docById.get(docId)
    if (!doc) continue
    let score = base * (KIND_WEIGHT[doc.kind] ?? 1)
    if (wantsHardware && doc.kind === 'hardware') score *= 2.5
    if (wantsDefinition && doc.kind === 'glossary') score *= 1.8
    if (wantsList && doc.kind === 'insight') score *= 0.8
    if (appliesNow(doc, ctx.scenario)) score *= 1.15
    const entry = items.get(doc.evidenceId) ?? { score: 0, docs: [] }
    entry.score = Math.max(entry.score, score)
    entry.docs.push(docId)
    items.set(doc.evidenceId, entry)
  }
  // An investigation named in the question goes first.
  named.forEach((accession, i) => {
    const entry = items.get(accession) ?? { score: 0, docs: [`inv:${accession}`] }
    entry.score = 10 - i
    items.set(accession, entry)
  })
  const ranked = [...items.entries()].sort((a, b) => b[1].score - a[1].score || (a[0] < b[0] ? -1 : 1))
  const pack: RetrievalResult['pack'] = []
  let investigations = 0
  for (const [evidenceId, entry] of ranked) {
    if (pack.length >= MAX_PACK) break
    const isInvestigation = evidenceId.startsWith('PSI-')
    if (isInvestigation && investigations >= (wantsList ? MAX_INVESTIGATIONS + 1 : MAX_INVESTIGATIONS)) continue
    if (isInvestigation) investigations += 1
    pack.push({ evidenceId, score: entry.score, matchedDocIds: entry.docs })
  }
  // A method item is added when the question mentions the score or the ranking.
  const want = /\bscore\b|coverage/.test(lowerQ) ? 'M-coverage' : /\brank/.test(lowerQ) ? 'M-ranking' : null
  if (want && !pack.some((p) => p.evidenceId === want)) pack.push({ evidenceId: want, score: 0, matchedDocIds: [] })
  return { mode, hasEvidence: true, pack, rows, scenarioChange }
}
