// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The browser-side answer checker. One pure function, used by the app, the pinned answer script
// and the tests. It proves that ids and numbers match the evidence. It cannot prove that a
// sentence means what its source means, which is why the badge says only "Sources and numbers checked".
import type { CheckResult, CheckedSegment, EvidenceItem, RemovalReason } from '../types.ts'

export const REFUSAL = 'The PSI evidence in EMBER does not answer that.'
// These two thresholds are judgment calls. The evaluation tunes them.
export const MIN_OVERLAP_WORDS = 3
export const MIN_OVERLAP_SHARE = 0.35

const STOP = new Set(
  'a an and are as at be been but by can could did do does for from had has have how if in into is it its may more most no nor not of on or our so such than that the their them then there these they this those to was were what when where which while who why will with would you your about above after also any both each few many much near only other over some under up very one two three four five six seven eight nine ten'.split(' '),
)

export function cleanAnswer(text: string): string {
  return text
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Finds every number in a text. Thousands separators and trailing zeros are dropped,
// so "22.20%" matches "22.2%" and "22%" does not. Accession names such as PSI-69 are not numbers.
export function numbersIn(text: string): string[] {
  const stripped = text.replace(/\[[^\]]*\]/g, ' ').replace(/\bPSI-\d+\b/gi, ' ').replace(/\b(?:I|G|H|M|HW|C)\d+\b/g, ' ')
  const out: string[] = []
  for (const match of stripped.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    let value = match[0].replace(/,(?=\d{3}\b)/g, '').replace(/,/g, '')
    if (value.includes('.')) value = value.replace(/0+$/, '').replace(/\.$/, '')
    value = value.replace(/^0+(?=\d)/, '')
    out.push(value)
  }
  return out
}

const stem = (word: string): string => word.replace(/(ing|ed|es|s)$/, '')

export function contentWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .match(/[a-z][a-z-]{2,}/g)
  if (!words) return []
  return [...new Set(words.filter((w) => !STOP.has(w)).map(stem))]
}

const VERDICT = [
  /\b(?:is|are|was|were|be|being|been|seems?|looks?|appears?|remains?|considered|deemed)\s+(?:\w+\s+){0,2}?(?:safe|unsafe)\b/i,
  /\bsafe\s+to\s+\w+/i,
  /\bunsafe\b/i,
  /\b(?:perfectly|completely|entirely|totally)\s+safe\b/i,
]

// "fire safety" is allowed. Calling anything a safety rating without the word "not" is removed.
export function hasVerdictLanguage(text: string): boolean {
  if (VERDICT.some((pattern) => pattern.test(text))) return true
  if (/safety rating/i.test(text) && !/\bnot\b|\bnever\b|n't\b/i.test(text)) return true
  return false
}

type RawSegment = { text: string; cites: string[] }

// Split by citations, not by full stops. Each run of words that ends in one or more [id] marks,
// plus a full stop on either side of them, is one segment. Words after the last citation are a
// segment with no citation.
export function splitByCitations(text: string): RawSegment[] {
  const segments: RawSegment[] = []
  const pattern = /((?:\s*[.!?]?\s*\[[^\]]{1,60}\])+)\s*[.!?]?/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    const body = text.slice(last, start).trim()
    const cites = [...match[1].matchAll(/\[([^\]]+)\]/g)].flatMap((m) => m[1].split(/[,\s]+/)).map((id) => id.trim()).filter(Boolean)
    last = start + match[0].length
    if (body === '' && segments.length > 0) {
      segments[segments.length - 1].cites.push(...cites)
      continue
    }
    segments.push({ text: body.replace(/[.!?]+$/, '').trim(), cites })
  }
  const tail = text.slice(last).replace(/^[\s.!?]+/, '').trim()
  if (tail !== '') segments.push({ text: tail.replace(/[.!?]+$/, '').trim(), cites: [] })
  return segments.filter((s) => s.text !== '')
}

export function checkAnswer(text: string, pack: EvidenceItem[], scenarioLine: string): CheckResult {
  const clean = cleanAnswer(text)
  if (clean.startsWith(REFUSAL) || clean.startsWith(REFUSAL.replace(/\.$/, ''))) {
    return { verdict: 'refusal', segments: [{ text: REFUSAL, cites: [], status: 'kept' }], kept: 1, removed: 0 }
  }
  const byId = new Map(pack.map((item) => [item.id, item]))
  const habitatNumbers = new Set(numbersIn(scenarioLine))
  const segments: CheckedSegment[] = []
  for (const raw of splitByCitations(clean)) {
    const cites = [...new Set(raw.cites)]
    const remove = (reason: RemovalReason) => segments.push({ text: raw.text, cites, status: 'removed', reason })
    if (cites.length === 0) {
      remove('no_citation')
      continue
    }
    if (cites.some((id) => id !== 'S' && !byId.has(id))) {
      remove('unknown_id')
      continue
    }
    const sourceText = cites.map((id) => (id === 'S' ? scenarioLine : (byId.get(id) as EvidenceItem).text)).join(' ')
    const allowed = new Set([...numbersIn(sourceText), ...habitatNumbers])
    if (numbersIn(raw.text).some((n) => !allowed.has(n))) {
      remove('number_not_in_source')
      continue
    }
    if (hasVerdictLanguage(raw.text)) {
      remove('verdict_language')
      continue
    }
    const words = contentWords(raw.text)
    const source = new Set(contentWords(sourceText))
    const shared = words.filter((w) => source.has(w)).length
    if (shared < MIN_OVERLAP_WORDS || shared / Math.max(1, words.length) < MIN_OVERLAP_SHARE) {
      remove('low_overlap')
      continue
    }
    segments.push({ text: raw.text, cites, status: 'kept' })
  }
  const kept = segments.filter((s) => s.status === 'kept').length
  const removed = segments.length - kept
  return { verdict: kept >= 2 ? 'verified' : 'rejected', segments, kept, removed }
}
