// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Free-text search for the Investigations list and the dashboard table. Case-insensitive.
// Every word of the query must appear somewhere in the item's text, in any order.
import type { Investigation, Test } from '../types.ts'

// The words of a query, lowercased. An empty or blank query has no words and matches everything.
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

export function matchesTerms(text: string, terms: string[]): boolean {
  if (terms.length === 0) return true
  const hay = text.toLowerCase()
  return terms.every((term) => hay.includes(term))
}

const join = (parts: (string | number | null | undefined)[]): string => parts.filter((p) => p != null && p !== '').join(' • ')

// An investigation is found by its names, its identifier, its plain summary and the fuels or
// materials its tests list.
export function investigationSearchText(inv: Investigation, tests: Test[]): string {
  const fuels = [...new Set(tests.map((t) => t.fuel).filter((f): f is string => Boolean(f)))]
  return join([inv.displayName, inv.acronym, inv.title, inv.accession, inv.summary.burned, inv.summary.varied, inv.summary.matters, ...fuels])
}

// A test is found by its id, its label, its investigation, its fuel or material, its fuel class,
// its outcome and its source table.
export function testSearchText(t: Test, investigationName: string): string {
  return join([t.id, t.label, t.accession, investigationName, t.fuel, t.fuelClass, t.outcome, t.table])
}
