// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The dashboard's map filter as one scope. The heading, the table, the map's marks, stacks, glow and
// Moon Base counts, its description and every drill it opens all count the tests of this one scope.
import type { DrillStep, FuelClass, Investigation, PillarOrFundamentals, Test } from '../types.ts'
import { FUEL_LABEL } from './nearby.ts'
import { matchesTerms, searchTerms, testSearchText } from './search.ts'

// q is the free-text search. It narrows the same tests as the other parts, so search and filters
// always agree.
export type MapScope = { pillar?: PillarOrFundamentals; fuel?: FuelClass; inv?: string; hw?: string; q?: string }
export type ScopeStep = Extract<DrillStep, { kind: 'scope' }>

export const SCOPE_PILLARS: PillarOrFundamentals[] = ['prevention', 'detection', 'suppression', 'fundamentals']
export const SCOPE_FUELS: FuelClass[] = ['solid', 'liquid', 'gas', 'aerosol']
export const ACCESSION = /^PSI-\d+$/
// One investigation, or the two or three Compare shows, joined by +.
export const ACCESSION_LIST = /^PSI-\d+(\+PSI-\d+){0,2}$/
export const HARDWARE_ID = /^[a-z0-9-]+$/
export const QUERY_MAX = 80

const PILLAR_WORD: Record<PillarOrFundamentals, string> = {
  prevention: 'Prevention',
  detection: 'Detection',
  suppression: 'Suppression',
  fundamentals: 'Fundamentals',
}

/** The scope from its parts, keeping only the parts that are well formed. */
export function makeScope(parts: { pillar?: string | null; fuel?: string | null; inv?: string | null; hw?: string | null; q?: string | null }): MapScope {
  const scope: MapScope = {}
  if (parts.pillar && SCOPE_PILLARS.includes(parts.pillar as PillarOrFundamentals)) scope.pillar = parts.pillar as PillarOrFundamentals
  if (parts.fuel && SCOPE_FUELS.includes(parts.fuel as FuelClass)) scope.fuel = parts.fuel as FuelClass
  if (parts.inv && ACCESSION_LIST.test(parts.inv)) scope.inv = parts.inv
  if (parts.hw && HARDWARE_ID.test(parts.hw)) scope.hw = parts.hw
  const q = (parts.q ?? '').trim().replace(/\s+/g, ' ').slice(0, QUERY_MAX)
  if (q) scope.q = q
  return scope
}

/** The scope as the dashboard address holds it: pillar, fuel, inv, hw and q. */
export const scopeFromParams = (params: URLSearchParams): MapScope =>
  makeScope({ pillar: params.get('pillar'), fuel: params.get('fuel'), inv: params.get('inv'), hw: params.get('hw'), q: params.get('q') })

/** The investigations a scope keeps, one or several. */
export const scopeInvs = (scope: MapScope): string[] => (scope.inv ? scope.inv.split('+') : [])

/** The scope of the investigations Compare shows, so its map counts only their tests. */
export const compareScope = (accessions: string[]): MapScope => makeScope({ inv: accessions.join('+') })

export const scopeActive = (scope: MapScope): boolean => Boolean(scope.pillar || scope.fuel || scope.inv || scope.hw || scope.q)

export function inScope(test: Test, inv: Investigation | undefined, scope: MapScope): boolean {
  if (scope.pillar && inv?.pillar !== scope.pillar && !inv?.secondaryPillars.includes(scope.pillar as never)) return false
  if (scope.fuel && test.fuelClass !== scope.fuel) return false
  if (scope.inv && !scopeInvs(scope).includes(test.accession)) return false
  if (scope.hw && inv?.hardwareFamily !== scope.hw) return false
  if (scope.q && !matchesTerms(testSearchText(test, inv?.displayName ?? test.accession), searchTerms(scope.q))) return false
  return true
}

export function scopeTests(tests: Test[], invByAcc: Record<string, Investigation>, scope: MapScope): Test[] {
  return scopeActive(scope) ? tests.filter((t) => inScope(t, invByAcc[t.accession], scope)) : tests
}

/** The drill step that carries the scope, so the panel counts the same tests as the map. */
export function scopeStep(scope: MapScope): ScopeStep | null {
  return scopeActive(scope) ? { kind: 'scope', ...scope } : null
}

/** The scope in words, such as "BASS-II, Solid materials, matching "silicone"". */
export function scopeLabel(scope: MapScope, invByAcc: Record<string, Investigation>, hardwareName: Record<string, string> = {}): string {
  const parts: string[] = []
  if (scope.inv) parts.push(scopeInvs(scope).map((a) => invByAcc[a]?.displayName ?? a).join(' and '))
  if (scope.pillar) parts.push(PILLAR_WORD[scope.pillar])
  if (scope.fuel) parts.push(FUEL_LABEL[scope.fuel])
  if (scope.hw) parts.push(hardwareName[scope.hw] ?? scope.hw)
  if (scope.q) parts.push(`matching "${scope.q}"`)
  return parts.join(', ')
}
