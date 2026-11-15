// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The Moon Base region of the Atmosphere Map, from the challenge statement:
// oxygen at 30 percent or more and pressure at 10.2 psi or less.
import type { Test } from '../types.ts'
import { isInverseFlame } from './nearby.ts'
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

/** The Moon Base counts the map prints: tests inside by fuel class, how many of the gas tests are
 * inverse flames, and droplet tests on the edge. An inverse flame's oxygen value is the burner's
 * oxidizer stream, not the chamber, so the count says how many of the gas tests are not cabin evidence. */
export function moonCounts(tests: Test[]): { total: number; solid: number; liquid: number; gas: number; inverse: number; edge: number } {
  const inside = tests.filter(inMoonRegion)
  const edge = tests.filter((t) => onMoonEdge(t) && t.fuelClass === 'liquid')
  const c = countBy(inside, (t) => t.fuelClass)
  const inverse = inside.filter((t) => t.fuelClass === 'gas' && isInverseFlame(t)).length
  return { total: inside.length, solid: c.solid || 0, liquid: c.liquid || 0, gas: c.gas || 0, inverse, edge: edge.length }
}

/** The inverse-flame clause that follows a gas count, or nothing when there are none. */
export function inverseClause(gas: number, inverse: number): string {
  if (inverse === 0) return ''
  const which = inverse === gas && gas > 1 ? `all ${inverse} of them inverse flames` : `${inverse} of them ${inverse === 1 ? 'an inverse flame' : 'inverse flames'}`
  return `${which} whose oxygen is the burner stream, not the chamber`
}
