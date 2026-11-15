// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Moon Base region of the Atmosphere Map, from the challenge statement:
// oxygen at 30 percent or more and pressure at 10.2 psi or less.
import type { Test } from '../types.ts'
import { countBy } from './stats.ts'
import { atmToPsi } from './units.ts'

export const MOON_REGION = {
  minO2: 0.3,
  maxPressurePsi: 10.2,
  // Tests just outside the pressure line, within 5 percent of it, are reported as on the edge.
  edgeMaxPressurePsi: 10.2 * 1.05,
}

const statesBoth = (t: Test): boolean =>
  t.o2 != null && t.pressureAtm != null && t.o2Source === 'table' && t.pressureSource === 'table'

// Pressures are compared at one decimal of a psi, the precision of the line itself.
const psi1 = (t: Test): number => Math.round(atmToPsi(t.pressureAtm as number) * 10) / 10

export function inMoonRegion(t: Test): boolean {
  return statesBoth(t) && (t.o2 as number) >= MOON_REGION.minO2 - 1e-9 && psi1(t) <= MOON_REGION.maxPressurePsi
}

export function onMoonEdge(t: Test): boolean {
  if (!statesBoth(t) || (t.o2 as number) < MOON_REGION.minO2 - 1e-9) return false
  const p = psi1(t)
  return p > MOON_REGION.maxPressurePsi && p <= MOON_REGION.edgeMaxPressurePsi
}

/** The Moon Base counts the map prints: tests inside by fuel class, and droplet tests on the edge. */
export function moonCounts(tests: Test[]): { total: number; solid: number; liquid: number; gas: number; edge: number } {
  const inside = tests.filter(inMoonRegion)
  const edge = tests.filter((t) => onMoonEdge(t) && t.fuelClass === 'liquid')
  const c = countBy(inside, (t) => t.fuelClass)
  return { total: inside.length, solid: c.solid || 0, liquid: c.liquid || 0, gas: c.gas || 0, edge: edge.length }
}
